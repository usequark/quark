/**
 * Admin Database Health Endpoint
 *
 * Provides detailed database diagnostics including connection latency,
 * pool configuration, and instrumentation status.  Protected by admin
 * token authorization via the `Authorization: Bearer <token>` header
 * or the `x-admin-token` header.
 *
 * The token is configured via the ADMIN_API_TOKEN environment variable.
 * When unset (local development), access is allowed and a warning is
 * logged on each request — always set ADMIN_API_TOKEN in production.
 *
 * Route: GET /api/admin/db-health
 * Auth:  Bearer token (ADMIN_API_TOKEN) or x-admin-token header
 *
 * Response (200):
 * {
 *   status: "ok",
 *   timestamp: "2026-07-19T...",
 *   database: {
 *     status: "ok",
 *     latencyMs: 2,
 *     driver: "pg",
 *     pool: { max: 10, idleTimeoutMillis: 30000, ... },
 *     instrumentation: "active" | "disabled" | "unavailable"
 *   }
 * }
 *
 * Response (401):
 * { error: "Missing authorization token" }
 *
 * Response (503):
 * { status: "error", database: { status: "error", message: "..." } }
 */

import {
	createLogger,
	createDbInstrumentation,
	requireAdminToken,
} from "@techstream/quark-core";
import { NextResponse } from "next/server";
import { getPoolConfig, pingDatabase } from "@techstream/quark-db";

const logger = createLogger("admin:db-health");

/** Overall timeout for the DB health probe (ms). */
const PROBE_TIMEOUT = 5000;

export async function GET(request) {
	// ── Admin token auth gate ──────────────────────────────────────
	const auth = requireAdminToken(request);
	if (!auth.authorized) {
		return NextResponse.json({ error: auth.reason }, { status: 401 });
	}

	try {
		const result = await new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("Database health probe timed out")),
				PROBE_TIMEOUT,
			);
			runDbHealthCheck().then(
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
		logger.error("Database health check failed", {
			error: error.message,
			stack: error.stack,
		});
		return NextResponse.json(
			{
				status: "error",
				timestamp: new Date().toISOString(),
				message: "Database health check failed",
			},
			{ status: 500 },
		);
	}
}

/**
 * Runs database diagnostics and returns a detailed health report.
 *
 * @returns {Promise<{
 *   status: string,
 *   timestamp: string,
 *   database: {
 *     status: string,
 *     latencyMs?: number,
 *     driver: string,
 *     pool: { max: number, idleTimeoutMillis: number, connectionTimeoutMillis: number },
 *     instrumentation: string,
 *     message?: string
 *   }
 * }>}
 */
async function runDbHealthCheck() {
	const poolConfig = getPoolConfig();

	const report = {
		status: "ok",
		timestamp: new Date().toISOString(),
		database: {
			status: "ok",
			driver: "pg",
			pool: poolConfig,
		},
	};

	// Report instrumentation status (best-effort)
	try {
		const ext = createDbInstrumentation();
		report.database.instrumentation = ext ? "active" : "disabled";
	} catch {
		report.database.instrumentation = "unavailable";
	}

	// Ping the database for connectivity + latency measurement.
	const dbResult = await pingDatabase({ timeout: PROBE_TIMEOUT });

	if (dbResult.status === "ok") {
		report.database.latencyMs = dbResult.latencyMs;
	} else {
		report.status = "error";
		report.database.status = "error";
		report.database.message = dbResult.message;
	}

	return report;
}
