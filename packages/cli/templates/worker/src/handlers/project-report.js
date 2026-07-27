/**
 * Project Report Handler
 * Aggregates cost + revenue data to generate profit/loss reports.
 * Can be triggered manually or run on a schedule.
 */

import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";

/**
 * Generate a comprehensive profit/loss report for a project.
 *
 * @param {import("bullmq").Job} bullJob
 * @param {import("@techstream/quark-core").Logger} logger
 * @returns {Promise<object>}
 */
export async function handleProjectReport(bullJob, logger) {
	const { projectId, months = 6 } = bullJob.data || {};

	if (!projectId) {
		// Generate reports for all projects
		const projects = await prisma.managedProject.findMany({
			select: { id: true },
		});

		if (projects.length === 0) {
			logger.info("No projects found — skipping report generation");
			return { generated: 0 };
		}

		logger.info("Generating reports for all projects", {
			count: projects.length,
		});

		const reports = [];
		for (const project of projects) {
			try {
				// Re-invoke with projectId set (plain object, not a real BullMQ job)
				const subJob = { data: { projectId: project.id, months } };
				const report = await handleProjectReport(subJob, logger);
				reports.push({ projectId: project.id, report });
			} catch (error) {
				logger.error("Failed to generate report for project", {
					projectId: project.id,
					error: error.message,
				});
			}
		}

		logger.info("Report generation completed for all projects", {
			count: reports.length,
		});
		return { generated: reports.length, reports };
	}

	logger.info("Generating project report", { projectId, months });

	// Fetch the project with its financial data
	const project = await prisma.managedProject.findUnique({
		where: { id: projectId },
		select: {
			id: true,
			name: true,
			slug: true,
			monthlyRevenue: true,
			monthlyBudget: true,
			billingCurrency: true,
			client: { select: { id: true, name: true } },
			status: true,
		},
	});

	if (!project) {
		throw new AppError(
			`ManagedProject ${projectId} not found`,
			404,
			"MANAGED_PROJECT_NOT_FOUND",
		);
	}

	// Determine date range
	const endDate = new Date();
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - months);

	// Fetch costs and deployments in parallel
	const [costs, deployments, latestDeployment] = await Promise.all([
		prisma.projectCost.findMany({
			where: {
				projectId,
				periodStart: { gte: startDate },
			},
			orderBy: { periodStart: "asc" },
		}),
		prisma.deployment.findMany({
			where: {
				projectId,
				deployedAt: { gte: startDate },
			},
			orderBy: { deployedAt: "desc" },
		}),
		prisma.deployment.findFirst({
			where: { projectId },
			orderBy: { deployedAt: "desc" },
			select: {
				status: true,
				deployedAt: true,
				commitMessage: true,
				branch: true,
			},
		}),
	]);

	// Calculate financial summary
	const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
	const monthlyRevenue = project.monthlyRevenue || 0;
	const monthlyBudget = project.monthlyBudget || 0;
	const monthlyCosts = months > 0 ? totalCosts / months : 0;
	const profit = monthlyRevenue - monthlyCosts;
	const profitMargin = monthlyRevenue > 0 ? (profit / monthlyRevenue) * 100 : 0;

	// Cost breakdown by type
	const costsByType = {};
	for (const cost of costs) {
		costsByType[cost.type] = (costsByType[cost.type] || 0) + cost.amount;
	}

	// Cost breakdown by service
	const costsByService = {};
	for (const cost of costs) {
		costsByService[cost.service] =
			(costsByService[cost.service] || 0) + cost.amount;
	}

	// Monthly trend data
	const monthlyTrend = {};
	for (const cost of costs) {
		const key = cost.periodStart.toISOString().slice(0, 7); // "YYYY-MM"
		if (!monthlyTrend[key]) monthlyTrend[key] = 0;
		monthlyTrend[key] += cost.amount;
	}

	// Deployment stats
	const deployStatusCounts = {};
	for (const dep of deployments) {
		deployStatusCounts[dep.status] = (deployStatusCounts[dep.status] || 0) + 1;
	}
	const totalDeployments = deployments.length;
	const successfulDeploys = deployStatusCounts.SUCCESS || 0;
	const failedDeploys = deployStatusCounts.FAILED || 0;
	const deploySuccessRate =
		totalDeployments > 0
			? Math.round((successfulDeploys / totalDeployments) * 10000) / 100
			: 0;

	// Build the report
	const report = {
		generatedAt: new Date().toISOString(),
		project: {
			id: project.id,
			name: project.name,
			slug: project.slug,
			client: project.client,
			status: project.status,
		},
		period: {
			months,
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
		},
		financial: {
			currency: project.billingCurrency,
			monthlyRevenue,
			monthlyBudget,
			monthlyCosts: Math.round(monthlyCosts * 100) / 100,
			totalCostsOverPeriod: Math.round(totalCosts * 100) / 100,
			profit: Math.round(profit * 100) / 100,
			profitMargin: Math.round(profitMargin * 100) / 100,
			budgetUtilization:
				monthlyBudget > 0
					? Math.round((monthlyCosts / monthlyBudget) * 10000) / 100
					: null,
			costsByType,
			costsByService,
			monthlyTrend,
		},
		deployments: {
			total: totalDeployments,
			successful: successfulDeploys,
			failed: failedDeploys,
			successRate: deploySuccessRate,
			byStatus: deployStatusCounts,
			latest: latestDeployment
				? {
						status: latestDeployment.status,
						deployedAt: latestDeployment.deployedAt,
						commitMessage: latestDeployment.commitMessage,
						branch: latestDeployment.branch,
					}
				: null,
		},
		// Summary text suitable for AI context injection
		summary:
			`${project.name} (${project.client?.name}): Over the last ${months} months, ` +
			`monthly revenue is ${project.billingCurrency}${monthlyRevenue.toFixed(2)} ` +
			`with monthly costs of ${project.billingCurrency}${monthlyCosts.toFixed(2)} ` +
			`(profit margin: ${profitMargin.toFixed(1)}%). ` +
			`${totalDeployments} deployments (${deploySuccessRate}% success rate).`,
	};

	logger.info("Project report generated", {
		projectId,
		profit: report.financial.profit,
		profitMargin: report.financial.profitMargin,
		deployments: report.deployments.total,
	});

	return report;
}
