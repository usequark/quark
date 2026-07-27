/**
 * Project Governance Guard
 *
 * Passive monitoring engine that evaluates each project's hourly resource
 * deltas against environment-defined thresholds. When a threshold is
 * breached, an alert email is dispatched — no automatic containment.
 *
 * Thresholds are configured via environment variables:
 *   GOVERNANCE_THRESHOLD_CPU_DELTA=50       # vCPU-min/hour
 *   GOVERNANCE_THRESHOLD_MEMORY_DELTA=2000  # GB-min/hour
 *   GOVERNANCE_THRESHOLD_EGRESS_DELTA=10    # GB/hour
 *   GOVERNANCE_THRESHOLD_DISK_DELTA=500     # GB-min/hour
 *
 * Alert email recipient:
 *   GOVERNANCE_ALERT_EMAIL=admin@example.com
 *   (falls back to ADMIN_EMAIL if not set)
 */

import { addJob, createLogger, createQueue } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@techstream/quark-jobs";

const log = createLogger("handler:governance-check");

// ── Threshold Resolution ───────────────────────────────────────────────────

/**
 * Resolve the effective threshold for a given metric from environment.
 * Returns null if no threshold is configured (check skipped).
 */
function getThreshold(metric) {
	const envKey = `GOVERNANCE_THRESHOLD_${metric}`;
	const envValue = process.env[envKey];
	if (envValue !== undefined) {
		const parsed = parseFloat(envValue);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return null;
}

// ── Violation Recording ────────────────────────────────────────────────────

async function recordViolation(projectId, metric, delta, threshold) {
	log.warn("Governance threshold breached", {
		projectId,
		metric,
		delta,
		threshold,
	});
}

// ── Main Handler ───────────────────────────────────────────────────────────

/**
 * Check governance thresholds for all projects (or a single project).
 * Reads the latest ProjectResourceMetric delta and compares against
 * environment-defined thresholds.
 *
 * Job data: { projectId: string } — if omitted, checks all projects
 */
export async function handleGovernanceCheck(bullJob, logger) {
	const { projectId } = bullJob.data;

	if (!projectId) {
		const projects = await prisma.managedProject.findMany({
			where: { railwayProjectId: { not: null } },
			select: { id: true, railwayProjectId: true, name: true },
		});

		if (projects.length === 0) {
			logger.info("No projects to check — skipping governance check");
			return { checked: 0 };
		}

		logger.info("Running governance check for all projects", {
			count: projects.length,
		});

		let violations = 0;
		for (const project of projects) {
			try {
				const result = await checkProjectGovernance(project, logger);
				if (result) violations++;
			} catch (error) {
				logger.error("Governance check failed for project", {
					projectId: project.id,
					error: error.message,
				});
			}
		}

		logger.info("Governance check completed", {
			total: projects.length,
			violations,
		});
		return { checked: projects.length, violations };
	}

	logger.info("Running governance check", { projectId });

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
		logger.warn("No railwayProjectId configured — skipping governance check", {
			projectId,
		});
		return { skipped: true, reason: "No railwayProjectId configured" };
	}

	const violation = await checkProjectGovernance(project, logger);
	return { checked: 1, violations: violation ? 1 : 0 };
}

/**
 * Evaluate a single project's latest metric delta against thresholds.
 * Returns true if a violation was detected and an alert was dispatched.
 * Does NOT perform any automatic containment — alert-only.
 */
async function checkProjectGovernance(project, logger) {
	const thresholds = {
		cpuDelta: getThreshold("CPU_DELTA"),
		memoryDelta: getThreshold("MEMORY_DELTA"),
		egressDelta: getThreshold("EGRESS_DELTA"),
		diskDelta: getThreshold("DISK_DELTA"),
	};

	// If no thresholds are configured, skip entirely
	if (
		thresholds.cpuDelta === null &&
		thresholds.memoryDelta === null &&
		thresholds.egressDelta === null &&
		thresholds.diskDelta === null
	) {
		return false;
	}

	// Fetch the latest metric snapshot
	const latest = await prisma.projectResourceMetric.findFirst({
		where: { projectId: project.id },
		orderBy: { syncedAt: "desc" },
	});

	if (!latest) {
		logger.info("No metrics data yet — skipping governance check", {
			projectId: project.id,
		});
		return false;
	}

	// Check each metric against its threshold
	const checks = [
		{
			metric: "cpuDelta",
			delta: latest.cpuDelta,
			threshold: thresholds.cpuDelta,
		},
		{
			metric: "memoryDelta",
			delta: latest.memoryDelta,
			threshold: thresholds.memoryDelta,
		},
		{
			metric: "egressDelta",
			delta: latest.networkTxDelta,
			threshold: thresholds.egressDelta,
		},
		{
			metric: "diskDelta",
			delta: latest.diskDelta,
			threshold: thresholds.diskDelta,
		},
	];

	const activeViolations = [];
	for (const { metric, delta, threshold } of checks) {
		if (threshold === null || delta === null || delta === undefined) continue;
		if (delta > threshold) {
			activeViolations.push({ metric, delta, threshold });
			await recordViolation(project.id, metric, delta, threshold);
		}
	}

	if (activeViolations.length > 0) {
		logger.warn("Governance threshold breached — dispatching alert", {
			projectId: project.id,
			projectName: project.name,
			violations: activeViolations,
		});

		// Dispatch email alert via the email queue (no automatic containment)
		const adminEmail =
			process.env.GOVERNANCE_ALERT_EMAIL || process.env.ADMIN_EMAIL;
		if (adminEmail) {
			try {
				const emailQueue = createQueue(JOB_QUEUES.EMAIL);
				await addJob(emailQueue, JOB_NAMES.SEND_GOVERNANCE_ALERT, {
					projectId: project.id,
					projectName: project.name,
					tier: "standard",
					violations: activeViolations,
					adminEmail,
				});
				logger.info("Governance alert email queued", {
					projectId: project.id,
					adminEmail,
				});
			} catch (error) {
				logger.error("Failed to queue governance alert email", {
					projectId: project.id,
					error: error.message,
				});
			}
		} else {
			logger.warn(
				"No GOVERNANCE_ALERT_EMAIL or ADMIN_EMAIL configured — alert not sent",
				{ projectId: project.id },
			);
		}
	}

	return activeViolations.length > 0;
}
