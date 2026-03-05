/**
 * Health Check Endpoint
 * Verifies the application and its dependencies are functioning correctly.
 * Times out after 5 seconds to prevent hanging.
 */

import { createLogger, createStorage, pingRedis } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";

const logger = createLogger("health");

/** Overall timeout for the health check (ms). */
const HEALTH_CHECK_TIMEOUT = 5000;

export async function GET() {
	try {
		const result = await Promise.race([
			runHealthChecks(),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error("Health check timed out")),
					HEALTH_CHECK_TIMEOUT,
				),
			),
		]);

		return NextResponse.json(result, {
			status: result.status === "ok" ? 200 : 503,
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
	try {
		await prisma.$queryRaw`SELECT 1`;
		health.checks.database = { status: "ok" };
	} catch (error) {
		health.checks.database = {
			status: "error",
			message: error.message,
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
		return { status: "error", provider, message: error.message };
	}
}
