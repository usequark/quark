/**
 * Metrics Endpoint
 * Exposes application metrics in Prometheus exposition format.
 *
 * GET /api/metrics — returns all registered metrics as plain text.
 *
 * In production, consider protecting this route behind authentication
 * or an internal-only network. Access is unrestricted by default to
 * support Prometheus scraping without additional config.
 */

import { createLogger, metrics } from "@techstream/quark-core";
import { NextResponse } from "next/server";

const logger = createLogger("metrics");

export async function GET() {
	try {
		const body = metrics.serialize();
		return new NextResponse(body, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; version=0.0.4; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		logger.error("Failed to serialize metrics", { error: error.message });
		return NextResponse.json(
			{ error: "Failed to collect metrics" },
			{ status: 500 },
		);
	}
}
