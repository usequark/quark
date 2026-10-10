/**
 * Health Check Endpoint
 *
 * Reports the status of the application and its dependencies. Every dependency
 * is probed concurrently, each under its own deadline, and the route always
 * answers `200` — the verdict lives in the body's `status` field.
 *
 * Why always 200: this endpoint is the platform healthcheck. A non-200 here
 * makes the orchestrator restart the container, which drops every warm
 * connection and produces a fresh connection storm on the dependency that was
 * already struggling. That turns a transient blip into a restart loop.
 * Callers that need a hard verdict should read `status`, not the status code.
 *
 * The probing itself lives in `@usequark/quark-core/health`. This route is the
 * thin HTTP shell around it: it wires the app's probes in and renders the
 * report. Projects hand-rolled their own copy of this orchestration, which is
 * what the core module replaces.
 */

import { createLogger } from "@usequark/quark-core/core";
import {
	checkQueues,
	checkStorage,
	runHealthChecks,
} from "@usequark/quark-core/health";
import { getRegisteredQueues } from "@usequark/quark-core/queue";
import { pingRedis } from "@usequark/quark-core/redis";
import { pingDatabase } from "@usequark/quark-db";
import { NextResponse } from "next/server";

const logger = createLogger("health");

export async function GET() {
	try {
		// `pingDatabase` is passed in rather than imported by the core module:
		// `@usequark/quark-db` depends on `@usequark/quark-core`, so core cannot
		// import it back without a cycle.
		const result = await runHealthChecks({
			probes: {
				database: pingDatabase,
				redis: pingRedis,
				storage: checkStorage,
				queues: () => checkQueues(getRegisteredQueues),
			},
		});

		// Always 200 — see the module comment. An orchestrator restarting this
		// service is what turns a dependency blip into an outage.
		return NextResponse.json(result, {
			status: 200,
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		// Unreachable in practice: every probe below is individually settled and
		// deadline-bounded, so runHealthChecks cannot reject. Kept so a future
		// edit that reintroduces a throw still returns a parseable body.
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
			{ status: 200, headers: { "Cache-Control": "no-store" } },
		);
	}
}
