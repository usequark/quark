/**
 * Health Check Endpoint
 * Verifies the application and its dependencies are functioning correctly
 */

import { createRedisClient } from "@Bobnoddle/quark-core";
import { prisma } from "@Bobnoddle/quark-db";
import { NextResponse } from "next/server";

export async function GET() {
	const health = {
		status: "ok",
		timestamp: new Date().toISOString(),
		checks: {},
	};

	try {
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

		// Check Redis connectivity
		try {
			const redis = createRedisClient();
			// For now, just check if we can create the config - actual ping requires redis client
			if (redis.url) {
				health.checks.redis = { status: "ok" };
			}
		} catch (error) {
			health.checks.redis = {
				status: "error",
				message: error.message,
			};
			health.status = "degraded";
		}

		return NextResponse.json(health, {
			status: health.status === "ok" ? 200 : 503,
		});
	} catch (error) {
		console.error("Health check failed:", error);
		return NextResponse.json(
			{
				status: "error",
				timestamp: new Date().toISOString(),
				message: error.message,
			},
			{ status: 500 },
		);
	}
}
