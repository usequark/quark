/**
 * Railway Sync Handlers
 * Syncs current deployment state and resource metrics from Railway API.
 * No longer syncs all historical deployments — only the current live state.
 */

import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { fetchProjectServices, fetchProjectUsage } from "../lib/railway.js";

/**
 * Sync current deployment state for a managed project.
 * Updates the project's currentStatus, currentDeployedAt, etc.
 *
 * Job data: { projectId: string } — if omitted, syncs all projects with railwayProjectId
 */
export async function handleRailwayStateSync(bullJob, logger) {
	if (!process.env.RAILWAY_API_TOKEN) {
		logger.info(
			"RAILWAY_API_TOKEN not configured — skipping Railway state sync",
		);
		return { skipped: true, reason: "RAILWAY_API_TOKEN not configured" };
	}

	const { projectId } = bullJob.data;

	if (!projectId) {
		// Sync all projects with railwayProjectId configured
		const projects = await prisma.managedProject.findMany({
			where: { railwayProjectId: { not: null } },
			select: { id: true, railwayProjectId: true, name: true },
		});

		if (projects.length === 0) {
			logger.info(
				"No projects with railwayProjectId configured — skipping state sync",
			);
			return { synced: 0 };
		}

		logger.info("Syncing current state for all projects", {
			count: projects.length,
		});

		let totalSynced = 0;
		for (const project of projects) {
			try {
				const result = await syncProjectState(project, logger);
				if (result) totalSynced++;
			} catch (error) {
				logger.error("Failed to sync state for project", {
					projectId: project.id,
					error: error.message,
				});
			}
		}

		logger.info("State sync completed for all projects", { totalSynced });
		return { synced: totalSynced };
	}

	logger.info("Syncing current state", { projectId });

	const project = await prisma.managedProject.findUnique({
		where: { id: projectId },
		select: { id: true, railwayProjectId: true, name: true },
	});

	if (!project) {
		throw new AppError(
			`ManagedProject ${projectId} not found`,
			404,
			"MANAGED_PROJECT_NOT_FOUND",
		);
	}

	if (!project.railwayProjectId) {
		logger.warn("No railwayProjectId configured — skipping state sync", {
			projectId,
		});
		return { skipped: true, reason: "No railwayProjectId configured" };
	}

	const result = await syncProjectState(project, logger);
	return { synced: result ? 1 : 0 };
}

/**
 * Sync current deployment state for a single project.
 * Fetches services and their current deployments from Railway API,
 * then updates the ManagedProject record.
 */
async function syncProjectState(project, logger) {
	logger.info("Fetching current state from Railway", {
		projectId: project.id,
		railwayProjectId: project.railwayProjectId,
	});

	const services = await fetchProjectServices(project.railwayProjectId);

	if (services.length === 0) {
		logger.warn("No services returned from Railway", {
			projectId: project.id,
			railwayProjectId: project.railwayProjectId,
		});
		// Still update lastSyncAt so we know we tried
		await prisma.managedProject.update({
			where: { id: project.id },
			data: { lastSyncAt: new Date() },
		});
		return true;
	}

	// Determine overall project state from services
	// If any service is DOWN or CRASHED, the project is degraded
	const statuses = services.map(
		(s) => s.currentDeployment?.status || "UNKNOWN",
	);
	const hasFailure = statuses.some((s) => s === "FAILED" || s === "CRASHED");
	const hasDeploying = statuses.some(
		(s) => s === "BUILDING" || s === "DEPLOYING",
	);
	const hasSuccess = statuses.some((s) => s === "SUCCESS");

	let currentStatus = "UNKNOWN";
	if (hasFailure) currentStatus = "DEGRADED";
	else if (hasDeploying) currentStatus = "DEPLOYING";
	else if (hasSuccess) currentStatus = "UP";

	// Find the latest deployment across all services for uptime
	const deployments = services
		.map((s) => s.currentDeployment)
		.filter(Boolean)
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	const latestDeployment = deployments[0] || null;

	// Update the project with current state
	await prisma.managedProject.update({
		where: { id: project.id },
		data: {
			currentStatus,
			currentDeployedAt: latestDeployment
				? new Date(latestDeployment.createdAt)
				: null,
			currentDeploymentId: latestDeployment?.id || null,
			serviceCount: services.length,
			lastSyncAt: new Date(),
		},
	});

	logger.info("Project state updated", {
		projectId: project.id,
		currentStatus,
		services: services.length,
		uptime: latestDeployment
			? `${Math.round((Date.now() - new Date(latestDeployment.createdAt).getTime()) / 1000 / 60)} minutes`
			: "unknown",
	});

	return true;
}

/**
 * Sync estimated resource usage (CPU, memory, etc.) for a managed project.
 * Stores as ProjectCost records with the measurement type and unit.
 *
 * Job data: { projectId: string } — if omitted, syncs all projects with railwayProjectId
 */
export async function handleRailwayUsageSync(bullJob, logger) {
	if (!process.env.RAILWAY_API_TOKEN) {
		logger.info(
			"RAILWAY_API_TOKEN not configured — skipping Railway usage sync",
		);
		return { skipped: true, reason: "RAILWAY_API_TOKEN not configured" };
	}

	const { projectId } = bullJob.data;

	if (!projectId) {
		const projects = await prisma.managedProject.findMany({
			where: { railwayProjectId: { not: null } },
			select: { id: true, railwayProjectId: true, name: true },
		});

		if (projects.length === 0) {
			logger.info(
				"No projects with railwayProjectId configured — skipping usage sync",
			);
			return { synced: 0 };
		}

		logger.info("Syncing resource usage for all projects", {
			count: projects.length,
		});

		let totalSynced = 0;
		for (const project of projects) {
			try {
				const count = await syncProjectUsage(project, logger);
				totalSynced += count;
			} catch (error) {
				logger.error("Failed to sync usage for project", {
					projectId: project.id,
					error: error.message,
				});
			}
		}

		logger.info("Resource usage sync completed for all projects", {
			totalSynced,
		});
		return { synced: totalSynced };
	}

	logger.info("Syncing resource usage", { projectId });

	const project = await prisma.managedProject.findUnique({
		where: { id: projectId },
		select: { id: true, railwayProjectId: true, name: true },
	});

	if (!project) {
		throw new AppError(
			`ManagedProject ${projectId} not found`,
			404,
			"MANAGED_PROJECT_NOT_FOUND",
		);
	}
	if (!project.railwayProjectId) {
		logger.warn("No railwayProjectId configured — skipping usage sync", {
			projectId,
		});
		return { skipped: true, reason: "No railwayProjectId configured" };
	}

	const count = await syncProjectUsage(project, logger);
	return { synced: count };
}

/**
 * Sync actual resource usage and calculate costs for a single project.
 * Uses the `usage` query which returns metered data matching Railway's dashboard.
 * Stores calculated costs as ProjectCost records with proper cost types.
 */
async function syncProjectUsage(project, logger) {
	const result = await fetchProjectUsage(project.railwayProjectId);

	if (
		!result.metrics.cpu &&
		!result.metrics.memory &&
		!result.metrics.networkTx
	) {
		logger.info("No usage data returned", { projectId: project.id });
		return 0;
	}

	const now = new Date();
	const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

	const { metrics, costs } = result;

	// Store each cost component as a ProjectCost record
	const costComponents = [
		{
			service: "cpu",
			type: "RAILWAY_HOSTING",
			amount: costs.cpu,
			description: `CPU: ${metrics.cpu.toFixed(2)} vCPU-min`,
		},
		{
			service: "memory",
			type: "RAILWAY_HOSTING",
			amount: costs.memory,
			description: `Memory: ${metrics.memory.toFixed(2)} GB-min`,
		},
		{
			service: "egress",
			type: "RAILWAY_EGRESS",
			amount: costs.egress,
			description: `Egress: ${metrics.networkTx.toFixed(4)} GB`,
		},
		{
			service: "volume",
			type: "RAILWAY_STORAGE",
			amount: costs.volume,
			description: `Volume: ${metrics.disk.toFixed(2)} GB-min`,
		},
	];

	if (costs.backup > 0) {
		costComponents.push({
			service: "backup",
			type: "RAILWAY_STORAGE",
			amount: costs.backup,
			description: `Backup: ${metrics.backup.toFixed(2)} GB-min`,
		});
	}

	let synced = 0;
	for (const component of costComponents) {
		// Upsert: find existing record for this project/service/period
		const existing = await prisma.projectCost.findFirst({
			where: {
				projectId: project.id,
				service: component.service,
				periodStart,
				periodEnd,
			},
		});

		if (existing) {
			await prisma.projectCost.update({
				where: { id: existing.id },
				data: {
					amount: component.amount,
					description: component.description,
				},
			});
		} else {
			await prisma.projectCost.create({
				data: {
					projectId: project.id,
					service: component.service,
					type: component.type,
					amount: component.amount,
					currency: "USD",
					periodStart,
					periodEnd,
					description: component.description,
					source: "railway-api",
				},
			});
		}
		synced++;
	}

	logger.info("Usage and costs synced", {
		projectId: project.id,
		totalCost: result.totalCost,
		components: synced,
	});

	return synced;
}

// ── Hourly Time-Series Metrics ─────────────────────────────────────────────

/**
 * Sync hourly resource metrics into ProjectResourceMetric.
 * Fetches cumulative usage from Railway, computes deltas from the previous
 * snapshot, and stores a new row. This builds a time series that enables
 * trend analysis and over/under-provisioning detection.
 *
 * Job data: { projectId: string } — if omitted, syncs all projects
 */
export async function handleRailwayMetricsSync(bullJob, logger) {
	if (!process.env.RAILWAY_API_TOKEN) {
		logger.info(
			"RAILWAY_API_TOKEN not configured — skipping Railway metrics sync",
		);
		return { skipped: true, reason: "RAILWAY_API_TOKEN not configured" };
	}

	const { projectId } = bullJob.data;

	if (!projectId) {
		const projects = await prisma.managedProject.findMany({
			where: { railwayProjectId: { not: null } },
			select: {
				id: true,
				railwayProjectId: true,
				name: true,
				serviceCount: true,
			},
		});

		if (projects.length === 0) {
			logger.info(
				"No projects with railwayProjectId configured — skipping metrics sync",
			);
			return { synced: 0 };
		}

		logger.info("Syncing resource metrics for all projects", {
			count: projects.length,
		});

		let totalSynced = 0;
		for (const project of projects) {
			try {
				const result = await syncProjectMetrics(project, logger);
				if (result) totalSynced++;
			} catch (error) {
				logger.error("Failed to sync metrics for project", {
					projectId: project.id,
					error: error.message,
				});
			}
		}

		logger.info("Resource metrics sync completed for all projects", {
			totalSynced,
		});
		return { synced: totalSynced };
	}

	logger.info("Syncing resource metrics", { projectId });

	const project = await prisma.managedProject.findUnique({
		where: { id: projectId },
		select: {
			id: true,
			railwayProjectId: true,
			name: true,
			serviceCount: true,
		},
	});

	if (!project) {
		throw new AppError(
			`ManagedProject ${projectId} not found`,
			404,
			"MANAGED_PROJECT_NOT_FOUND",
		);
	}
	if (!project.railwayProjectId) {
		logger.warn("No railwayProjectId configured — skipping metrics sync", {
			projectId,
		});
		return { skipped: true, reason: "No railwayProjectId configured" };
	}

	const result = await syncProjectMetrics(project, logger);
	return { synced: result ? 1 : 0 };
}

/**
 * Fetch current cumulative usage from Railway, compute deltas from the
 * most recent ProjectResourceMetric snapshot, and persist a new row.
 */
async function syncProjectMetrics(project, logger) {
	const result = await fetchProjectUsage(project.railwayProjectId);

	if (
		!result.metrics.cpu &&
		!result.metrics.memory &&
		!result.metrics.networkTx
	) {
		logger.info("No usage data returned for metrics", {
			projectId: project.id,
		});
		return false;
	}

	const { metrics } = result;

	// Find the most recent metric snapshot to compute deltas
	const previous = await prisma.projectResourceMetric.findFirst({
		where: { projectId: project.id },
		orderBy: { syncedAt: "desc" },
	});

	const cpuDelta = previous ? metrics.cpu - previous.cpuUsage : null;
	const memoryDelta = previous ? metrics.memory - previous.memoryUsage : null;
	const networkTxDelta = previous
		? metrics.networkTx - previous.networkTx
		: null;
	const networkRxDelta = previous
		? (metrics.networkRx || 0) - (previous.networkRx || 0)
		: null;
	const diskDelta = previous ? metrics.disk - previous.diskUsage : null;
	const backupDelta = previous
		? (metrics.backup || 0) - (previous.backupUsage || 0)
		: null;

	await prisma.projectResourceMetric.create({
		data: {
			projectId: project.id,
			cpuUsage: metrics.cpu,
			memoryUsage: metrics.memory,
			networkTx: metrics.networkTx,
			networkRx: metrics.networkRx || 0,
			diskUsage: metrics.disk,
			backupUsage: metrics.backup || 0,
			cpuDelta,
			memoryDelta,
			networkTxDelta,
			networkRxDelta,
			diskDelta,
			backupDelta,
			serviceCount: project.serviceCount,
			source: "railway-api",
			syncedAt: new Date(),
		},
	});

	logger.info("Resource metrics snapshot saved", {
		projectId: project.id,
		cpu: metrics.cpu,
		memory: metrics.memory,
		cpuDelta,
		memoryDelta,
	});

	return true;
}
