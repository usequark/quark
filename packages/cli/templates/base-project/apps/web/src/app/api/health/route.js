/**
 * Health Check Endpoint
 * Verifies the application and its dependencies are functioning correctly.
 * Times out after 5 seconds to prevent hanging.
 */

import {
	createLogger,
	createStorage,
	getRegisteredQueues,
	pingRedis,
} from "@usequark/quark-core";
import { pingDatabase } from "@usequark/quark-db";
import { NextResponse } from "next/server";

const logger = createLogger("health");

/** Overall timeout for the health check (ms). */
const HEALTH_CHECK_TIMEOUT = 5000;

export async function GET() {
	try {
		const result = await new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("Health check timed out")),
				HEALTH_CHECK_TIMEOUT,
			);
			runHealthChecks().then(
				(val) => {
					clearTimeout(timer);
					resolve(val);
				},
				(err) => {
					clearTimeout(timer);
					reject(err);
				},
			);
		});

		return NextResponse.json(result, {
			status: result.status === "error" ? 503 : 200,
		});
	} catch (error) {
		logger.error("Health check failed", {
			error: error.message,
			stack: error.stack,
		});
		return NextResponse.json(
			{
				status: "error",
				timestamp: new Date().toISOString(),
				message: "Service health check failed",
			},
			{ status: 500 },
		);
	}
}

/**
 * Runs all individual health checks and aggregates the results.
 * @returns {Promise<{ status: string, timestamp: string, checks: Record<string, object> }>}
 */
async function runHealthChecks() {
	const health = {
		status: "ok",
		timestamp: new Date().toISOString(),
		checks: {},
	};

	// Check database connectivity
	const dbResult = await pingDatabase();
	if (dbResult.status === "ok") {
		health.checks.database = { status: "ok", latencyMs: dbResult.latencyMs };
	} else {
		health.checks.database = {
			status: "error",
			message: dbResult.message,
		};
		health.status = "degraded";
	}

	// Check Redis connectivity (actual PING)
	const redisResult = await pingRedis();
	if (redisResult.status === "ok") {
		health.checks.redis = { status: "ok", latencyMs: redisResult.latencyMs };
	} else {
		health.checks.redis = {
			status: "error",
			message: redisResult.message,
		};
		health.status = "degraded";
	}

	// Check storage connectivity
	const storageResult = await checkStorage();
	health.checks.storage = storageResult;
	if (storageResult.status === "error") {
		health.status = "degraded";
	}

	// Check queue depths (only when queues are registered in this process)
	const registeredQueues = getRegisteredQueues();
	if (registeredQueues.size > 0) {
		const entries = [...registeredQueues.entries()];
		const results = await Promise.allSettled(
			entries.map(([, queue]) =>
				Promise.all([
					queue.getWaitingCount(),
					queue.getActiveCount(),
					queue.getFailedCount(),
				]),
			),
		);

		const queueChecks = {};
		for (let i = 0; i < entries.length; i++) {
			const [name] = entries[i];
			const result = results[i];
			if (result.status === "fulfilled") {
				const [waiting, active, failed] = result.value;
				queueChecks[name] = { status: "ok", waiting, active, failed };
			} else {
				const message =
					process.env.NODE_ENV === "production"
						? "Queue unavailable"
						: result.reason?.message;
				queueChecks[name] = { status: "error", message };
				health.status = "degraded";
			}
		}
		health.checks.queues = queueChecks;
	}

	return health;
}

/**
 * Verifies storage is reachable and writable by writing then deleting a
 * small sentinel object. Uses whichever provider is configured via
 * STORAGE_PROVIDER (defaults to "local" when unset).
 * @returns {Promise<{ status: string, provider: string, message?: string }>}
 */
async function checkStorage() {
	const provider = process.env.STORAGE_PROVIDER || "local";
	try {
		const storage = createStorage();
		const sentinelKey = ".health-check-sentinel";
		await storage.put(sentinelKey, Buffer.from("ok"), {
			contentType: "text/plain",
		});
		await storage.delete(sentinelKey);
		return { status: "ok", provider };
	} catch (error) {
		const message =
			process.env.NODE_ENV === "production"
				? "Storage unavailable"
				: error.message;
		return { status: "error", provider, message };
	}
}
