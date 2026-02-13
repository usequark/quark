/**
 * Health Check Endpoint
 * Verifies the application and its dependencies are functioning correctly
 */

import { redis } from "@bobnoddle/quark-core";
import { prisma } from "@bobnoddle/quark-db";
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
			await redis.ping();
			health.checks.redis = { status: "ok" };
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
