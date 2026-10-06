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

/** Ceiling for the whole check (ms). */
const HEALTH_CHECK_TIMEOUT = 5000;

/** Ceiling for one dependency probe (ms). Clamped to the overall budget, so a
 * single probe can never outlive the request. */
const PROBE_TIMEOUT = 3000;

/** Message returned in place of a real error when NODE_ENV is production. */
const GENERIC_MESSAGES = {
	database: "Database unavailable",
	redis: "Redis unavailable",
	storage: "Storage unavailable",
	queue: "Queue unavailable",
};

export async function GET() {
	try {
		const result = await runHealthChecks();

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

/**
 * Runs every dependency probe concurrently and aggregates the results.
 *
 * Concurrency matters as much as the deadlines: run sequentially, a 3s database
 * timeout plus a 3s Redis timeout exhausts the 5s budget before storage is even
 * attempted, and the whole request falls through to the give-up path.
 *
 * @returns {Promise<{ status: string, timestamp: string, durationMs: number, checks: Record<string, object> }>}
 */
async function runHealthChecks() {
	const startedAt = performance.now();

	// Every probe is wrapped in settleProbe(), so this Promise.all cannot reject
	// and cannot outlast the deadline.
	const [database, redis, storage, queues] = await Promise.all([
		settleProbe("database", () => pingDatabase()),
		settleProbe("redis", () => pingRedis()),
		// `provider` rides along on the error result so a failure still names the
		// provider that failed — settleProbe owns the message redaction.
		settleProbe("storage", checkStorage, {
			provider: process.env.STORAGE_PROVIDER || "local",
		}),
		settleProbe("queues", checkQueues),
	]);

	const checks = { database, redis, storage };
	if (queues) checks.queues = queues;

	return {
		// "degraded" means at least one dependency failed. Both this and "ok"
		// answer 200 — see the module comment.
		status: Object.values(checks).some(isFailing) ? "degraded" : "ok",
		timestamp: new Date().toISOString(),
		durationMs: Math.round(performance.now() - startedAt),
		checks,
	};
}

/**
 * Reports whether a check entry counts as a failure. Handles both a flat probe
 * result (`{ status: "error" }`) and the nested queue map, where the verdict
 * lives on each queue rather than on the map itself.
 *
 * @param {unknown} check
 * @returns {boolean}
 */
function isFailing(check) {
	if (!check || typeof check !== "object") return false;

	// A flat probe result carries its own `status`. The nested queue map does
	// not, so fall through to its entries.
	if (typeof (/** @type {any} */ (check).status) === "string") {
		return /** @type {any} */ (check).status === "error";
	}

	return Object.values(/** @type {Record<string, any>} */ (check)).some(
		(entry) => entry?.status === "error",
	);
}

/**
 * Runs one dependency probe with its own deadline and normalises every failure
 * mode — rejection, timeout, or a probe that never settles — into a result
 * object. Never throws, so callers can rely on `Promise.all` resolving.
 *
 * @param {string} name - Probe name, also the key under `checks`.
 * @param {() => Promise<object>} probe
 * @param {object} [context] - Fields to merge into the error result.
 * @returns {Promise<{ status: string } & Record<string, unknown>>}
 */
async function settleProbe(name, probe, context = {}) {
	// A probe that hangs must not hold up the aggregate, and must never outlive
	// the overall budget. The timer is always cleared, so it never leaks.
	let timer;
	const deadline = new Promise((resolve) => {
		timer = setTimeout(
			() => resolve({ status: "error", message: `${name} check timed out` }),
			Math.min(PROBE_TIMEOUT, HEALTH_CHECK_TIMEOUT),
		);
	});

	try {
		return withSafeMessage(name, await Promise.race([probe(), deadline]));
	} catch (/** @type {any} */ error) {
		return withSafeMessage(name, {
			...context,
			status: "error",
			message: error?.message,
		});
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Returns a check result whose message is safe to serve publicly.
 *
 * A probe can signal failure two ways — by rejecting, or by *resolving* with
 * `{ status: "error", message }`. Both are routed through here so neither can
 * bypass the redaction: `pingRedis` returned `{ status: "error" }` carrying the
 * raw `REDIS_URL`, so a normaliser that only handled rejections would have let
 * the password straight through.
 *
 * @param {string} name - Probe name.
 * @param {object} [result]
 * @returns {object}
 */
function withSafeMessage(name, result) {
	if (result?.status !== "error") return result;

	const { message, ...rest } = result;
	return { ...rest, status: "error", message: safeMessage(name, message) };
}

/**
 * Reduces a failure to a message safe to return from an unauthenticated route.
 *
 * Driver errors carry the connection string they failed on, so the raw text is
 * only echoed outside production. `pingRedis`/`pingDatabase` redact at the
 * source regardless; this is the second layer.
 *
 * @param {string} name - Probe name.
 * @param {string|Error} [source] - The failure message or the error itself.
 * @returns {string}
 */
function safeMessage(name, source) {
	if (process.env.NODE_ENV === "production") {
		return GENERIC_MESSAGES[name] ?? "Check unavailable";
	}

	return source?.message ?? source ?? "Unknown error";
}

/**
 * Verifies storage is reachable and writable by writing then deleting a
 * small sentinel object. Uses whichever provider is configured via
 * STORAGE_PROVIDER (defaults to "local" when unset).
 * @returns {Promise<{ status: string, provider: string }>}
 */
async function checkStorage() {
	const provider = process.env.STORAGE_PROVIDER || "local";
	const storage = createStorage();
	const sentinelKey = ".health-check-sentinel";

	await storage.put(sentinelKey, Buffer.from("ok"), {
		contentType: "text/plain",
	});
	await storage.delete(sentinelKey);

	return { status: "ok", provider };
}

/**
 * Reports queue depths. Only meaningful in a process that registered the
 * queues — the web app registers none, so this resolves to null and the key is
 * omitted from the response rather than reported as a false pass.
 *
 * @returns {Promise<Record<string, { status: string, waiting?: number, active?: number, failed?: number, message?: string }> | null>}
 */
async function checkQueues() {
	const registeredQueues = getRegisteredQueues();
	if (registeredQueues.size === 0) return null;

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
			queueChecks[name] = withSafeMessage("queue", {
				status: "error",
				message: result.reason?.message,
			});
		}
	}

	return queueChecks;
}
