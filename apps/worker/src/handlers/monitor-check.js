/**
 * Monitor Check Handler
 * Pings configured endpoints and records uptime status.
 * Runs on a cron schedule via repeatable BullMQ job.
 */

import { prisma } from "@techstream/quark-db";

/**
 * Parse a status code range string like "200-299".
 * Returns true if the status code falls within the range.
 * @param {number} statusCode - HTTP status code
 * @param {string} range - Range string (e.g. "200-299", "200", "200-")
 * @returns {boolean}
 */
function statusInRange(statusCode, range) {
	const trimmed = range.trim();

	// Single code: "200"
	if (!trimmed.includes("-")) {
		return statusCode === parseInt(trimmed, 10);
	}

	// Range: "200-299"
	const [start, end] = trimmed.split("-").map((s) => parseInt(s.trim(), 10));
	if (!Number.isNaN(start) && !Number.isNaN(end)) {
		return statusCode >= start && statusCode <= end;
	}

	// Open-ended: "200-" or "-299"
	if (!Number.isNaN(start)) return statusCode >= start;
	if (!Number.isNaN(end)) return statusCode <= end;

	return false;
}

/**
 * Check a single HTTP endpoint.
 * @param {object} monitor - Monitor record from DB
 * @returns {Promise<{status: string, responseTime: number, error?: string}>}
 */
async function checkHttpEndpoint(monitor) {
	const startTime = Date.now();

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			monitor.timeout * 1000,
		);

		const response = await fetch(monitor.url, {
			method: monitor.method || "GET",
			signal: controller.signal,
			headers:
				monitor.method === "HEAD" ? {} : { "User-Agent": "Quark-Monitor/1.0" },
		});

		clearTimeout(timeoutId);
		const responseTime = Date.now() - startTime;

		// Check status code against expected ranges
		const statusOk = (monitor.expectedStatusCodes || ["200-299"]).some(
			(range) => statusInRange(response.status, range),
		);

		let keywordOk = true;

		// For JSON_QUERY type, check keyword in body
		if (monitor.type === "JSON_QUERY" && monitor.expectedKeyword) {
			const body = await response.text();
			const hasKeyword = body.includes(monitor.expectedKeyword);
			keywordOk = monitor.invertKeyword ? !hasKeyword : hasKeyword;
		}

		const isUp = statusOk && keywordOk;

		return {
			status: isUp ? "UP" : "DOWN",
			responseTime,
			error: isUp
				? undefined
				: `Status ${response.status}${!keywordOk ? ", keyword not found" : ""}`,
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;
		return {
			status: "DOWN",
			responseTime,
			error:
				error.name === "AbortError"
					? `Timeout after ${monitor.timeout}s`
					: error.message,
		};
	}
}

/**
 * Check a ping endpoint using fetch as a proxy.
 * @param {object} monitor - Monitor record from DB
 * @returns {Promise<{status: string, responseTime: number, error?: string}>}
 */
async function checkPingEndpoint(monitor) {
	// For ping type, we try to establish a connection without downloading content
	const startTime = Date.now();

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			Math.min(monitor.timeout, 10) * 1000,
		);

		const response = await fetch(monitor.url, {
			method: "HEAD",
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		const responseTime = Date.now() - startTime;

		return {
			status: response.ok ? "UP" : "DOWN",
			responseTime,
			error: response.ok ? undefined : `HTTP ${response.status}`,
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;
		return {
			status: "DOWN",
			responseTime,
			error: error.name === "AbortError" ? "Timeout" : error.message,
		};
	}
}

/**
 * Run health checks for all active monitors.
 * Called either for a specific project or all projects.
 *
 * Job data: { projectId?: string }
 * If projectId is provided, only checks monitors for that project.
 * If omitted, checks ALL active monitors across all projects.
 */
export async function handleMonitorCheck(bullJob, logger) {
	const { projectId } = bullJob.data || {};

	logger.info("Running monitor checks", { projectId: projectId || "all" });

	// Get monitors to check
	const where = { active: true };
	if (projectId) where.projectId = projectId;

	const monitors = await prisma.monitor.findMany({
		where,
		include: {
			project: { select: { id: true, name: true } },
		},
	});

	if (monitors.length === 0) {
		logger.info("No active monitors to check");
		return { checked: 0 };
	}

	logger.info("Checking monitors", { count: monitors.length });

	const results = [];

	for (const monitor of monitors) {
		logger.info("Checking monitor", {
			monitorId: monitor.id,
			name: monitor.name,
			url: monitor.url,
			type: monitor.type,
		});

		let result;

		if (monitor.type === "PING") {
			result = await checkPingEndpoint(monitor);
		} else {
			result = await checkHttpEndpoint(monitor);
		}

		// Update monitor status in DB
		await prisma.monitor.update({
			where: { id: monitor.id },
			data: {
				lastStatus: result.status,
				lastChecked: new Date(),
				lastResponseTime: result.responseTime,
				// Update uptime percentage (simple rolling calculation)
				uptime:
					result.status === "UP"
						? Math.min(100, (monitor.uptime || 100) * 0.9 + 100 * 0.1)
						: (monitor.uptime || 100) * 0.9,
			},
		});

		// Record check event for history
		await prisma.monitorEvent.create({
			data: {
				monitorId: monitor.id,
				status: result.status,
				responseTime: result.responseTime,
				error: result.error || null,
				checkedAt: new Date(),
			},
		});

		if (result.status === "DOWN") {
			logger.warn("Monitor DOWN", {
				monitorId: monitor.id,
				name: monitor.name,
				error: result.error,
				responseTime: result.responseTime,
			});
		}

		results.push({
			id: monitor.id,
			name: monitor.name,
			projectId: monitor.projectId,
			projectName: monitor.project?.name,
			status: result.status,
			responseTime: result.responseTime,
			error: result.error,
		});
	}

	const upCount = results.filter((r) => r.status === "UP").length;
	const downCount = results.filter((r) => r.status === "DOWN").length;

	logger.info("Monitor checks completed", {
		total: results.length,
		up: upCount,
		down: downCount,
	});

	return {
		checked: results.length,
		up: upCount,
		down: downCount,
		results,
	};
}
