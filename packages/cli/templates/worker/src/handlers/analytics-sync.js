/**
 * Analytics Sync Handler
 * Fetches analytics data from Umami database and stores summary.
 */

import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { getProjectAnalytics } from "@techstream/quark-db/umami";

/**
 * Sync Umami analytics data for a managed project.
 * Fetches pageviews, visitors, bounce rate, top pages, and traffic sources.
 *
 * Job data: { projectId: string }
 */
export async function handleAnalyticsSync(bullJob, logger) {
	if (!process.env.UMAMI_DATABASE_URL) {
		logger.info("UMAMI_DATABASE_URL not configured — skipping analytics sync");
		return { skipped: true, reason: "UMAMI_DATABASE_URL not configured" };
	}

	const { projectId } = bullJob.data;

	if (!projectId) {
		// Sync analytics for all projects with umamiWebsiteId configured
		const projects = await prisma.managedProject.findMany({
			where: { umamiWebsiteId: { not: null } },
			select: { id: true, name: true, umamiWebsiteId: true },
		});

		if (projects.length === 0) {
			logger.info(
				"No projects with umamiWebsiteId configured — skipping analytics sync",
			);
			return { synced: false };
		}

		logger.info("Syncing analytics for all projects", {
			count: projects.length,
		});

		const results = [];
		for (const project of projects) {
			try {
				const analytics = await getProjectAnalytics(project.umamiWebsiteId);
				results.push({
					projectId: project.id,
					projectName: project.name,
					analytics: analytics.error ? null : analytics,
					error: analytics.error || null,
				});
			} catch (error) {
				logger.error("Failed to sync analytics for project", {
					projectId: project.id,
					error: error.message,
				});
				results.push({ projectId: project.id, error: error.message });
			}
		}

		logger.info("Analytics sync completed for all projects", {
			count: results.length,
		});
		return { synced: true, results };
	}

	logger.info("Syncing Umami analytics", { projectId });

	// Get the managed project to find umamiWebsiteId
	const project = await prisma.managedProject.findUnique({
		where: { id: projectId },
		select: { id: true, name: true, umamiWebsiteId: true },
	});

	if (!project) {
		throw new AppError(
			`ManagedProject ${projectId} not found`,
			404,
			"MANAGED_PROJECT_NOT_FOUND",
		);
	}

	if (!project.umamiWebsiteId) {
		logger.warn("No umamiWebsiteId configured — skipping analytics sync", {
			projectId,
		});
		return { skipped: true, reason: "No umamiWebsiteId configured" };
	}

	// Fetch analytics from Umami DB
	const analytics = await getProjectAnalytics(project.umamiWebsiteId);

	if (analytics.error) {
		logger.warn("Analytics fetch returned error", {
			projectId,
			error: analytics.error,
		});
		return { skipped: true, reason: analytics.error };
	}

	logger.info("Analytics synced", {
		projectId,
		pageviews: analytics.summary.pageviews,
		visitors: analytics.summary.visitors,
	});

	return {
		synced: true,
		data: analytics,
	};
}
