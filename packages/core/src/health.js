/**
 * @usequark/quark-core - Health Checks
 *
 * Dependency health probing for the platform healthcheck endpoint.
 *
 * Two invariants this module exists to hold:
 *
 * 1. **The aggregate completes inside one overall deadline.** Every probe runs
 *    concurrently and under its own deadline, clamped to the overall budget, so
 *    a hung dependency cannot hold the request open. Run sequentially, the sum
 *    of three 3s timeouts exhausts a 5s budget before the last probe starts —
 *    and an exhausted budget reads as a dead service.
 *
 * 2. **No message leaves carrying a credential.** Driver errors embed the
 *    connection string they failed on. Probes are normalised in one place so
 *    both failure shapes — rejecting, *and* resolving with
 *    `{ status: "error", message }` — pass through redaction. Handling only
 *    rejections is what let `pingRedis` publish the Redis password from an
 *    unauthenticated endpoint once already.
 *
 * Usage:
 *   const report = await runHealthChecks({
 *     probes: { database: pingDatabase, storage: checkStorage },
 *   });
 *   // → { status: "ok" | "degraded", checks: { database: {...} } }
 */

import { createLogger } from "./logger.js";
import { createStorage } from "./storage.js";
import { redactUrl } from "./utils.js";

const logger = createLogger("health");

/** Ceiling for one dependency probe (ms). Clamped to the overall budget. */
export const DEFAULT_PROBE_TIMEOUT = 3000;

/** Ceiling for the whole check (ms). */
export const DEFAULT_HEALTH_TIMEOUT = 5000;

/**
 * Message returned in place of a real error when NODE_ENV is production.
 * Keyed by probe name.
 */
const GENERIC_MESSAGES = {
	database: "Database unavailable",
	redis: "Redis unavailable",
	storage: "Storage unavailable",
	queue: "Queue unavailable",
};

/**
 * Runs every dependency probe concurrently and aggregates the results.
 *
 * Never rejects: each probe is individually settled and deadline-bounded, so a
 * rejecting probe becomes a `{ status: "error" }` entry rather than an exception
 * out of the aggregate.
 *
 * @param {object} options
 * @param {Record<string, () => Promise<object>|object>} options.probes - Probe name → probe fn.
 * @param {number} [options.timeout=5000] - Overall budget in ms.
 * @param {number} [options.probeTimeout=3000] - Per-probe budget in ms.
 * @returns {Promise<{ status: string, timestamp: string, durationMs: number, checks: Record<string, object> }>}
 */
export async function runHealthChecks({
	probes,
	timeout = DEFAULT_HEALTH_TIMEOUT,
	probeTimeout = DEFAULT_PROBE_TIMEOUT,
} = {}) {
	const startedAt = performance.now();
	const names = Object.keys(probes ?? {});

	// Every probe is wrapped in settleProbe(), so this Promise.all cannot reject
	// and cannot outlast the deadline. Concurrency is the point: three sequential
	// 3s probes would exceed a 5s budget on their own.
	const settled = await Promise.all(
		names.map((name) =>
			settleProbe(name, probes[name], { timeout, probeTimeout }),
		),
	);

	const checks = {};
	for (let i = 0; i < names.length; i++) {
		const result = settled[i];
		// A probe may return null to opt out (e.g. queues when none are registered
		// in this process). Omitting the key is honest; reporting a false pass is not.
		if (result !== null) checks[names[i]] = result;
	}

	return {
		// "degraded" means at least one dependency failed. The HTTP status is the
		// caller's decision — see the module comment on why it is not derived here.
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
export function isFailing(check) {
	if (!check || typeof check !== "object") return false;

	// A flat probe result carries its own `status`. The nested queue map does not,
	// so fall through to its entries.
	if (typeof check.status === "string") {
		return check.status === "error";
	}

	return Object.values(check).some((entry) => entry?.status === "error");
}

/**
 * Runs one dependency probe with its own deadline and normalises every failure
 * mode — rejection, timeout, or a probe that never settles — into a result
 * object. Never throws, so callers can rely on `Promise.all` resolving.
 *
 * @param {string} name - Probe name, also the key under `checks`.
 * @param {() => Promise<object>|object} probe
 * @param {object} [options]
 * @param {number} [options.timeout]
 * @param {number} [options.probeTimeout]
 * @returns {Promise<object|null>}
 */
async function settleProbe(name, probe, { timeout, probeTimeout }) {
	// A probe that hangs must not hold up the aggregate, and must never outlive
	// the overall budget. The timer is always cleared, so it never leaks.
	let timer;
	const deadline = new Promise((resolve) => {
		timer = setTimeout(
			() => resolve({ status: "error", message: `${name} check timed out` }),
			Math.min(probeTimeout, timeout),
		);
	});

	try {
		const result = await Promise.race([
			Promise.resolve().then(probe),
			deadline,
		]);
		// A probe that opts out (null/undefined) is reported as absent, not as a pass.
		if (result === null || result === undefined) return null;
		return withSafeMessage(name, result);
	} catch (error) {
		return withSafeMessage(name, { status: "error", message: error?.message });
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Returns a check result whose message is safe to serve publicly.
 *
 * A probe can signal failure two ways — by rejecting, or by *resolving* with
 * `{ status: "error", message }`. Both are routed through here so neither can
 * bypass the redaction.
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
 * only echoed outside production — and even then it goes through `redactUrl()`
 * first, which strips any userinfo segment that survived the driver's own
 * formatting. In production a fixed generic message is returned.
 *
 * @param {string} name - Probe name.
 * @param {string|Error} [source] - The failure message or the error itself.
 * @returns {string}
 */
function safeMessage(name, source) {
	if (process.env.NODE_ENV === "production") {
		return GENERIC_MESSAGES[name] ?? "Check unavailable";
	}

	const text = source?.message ?? (typeof source === "string" ? source : "");
	if (!text) return "Unknown error";
	return redactUrl(text);
}

/**
 * Verifies storage is reachable and writable by writing then deleting a small
 * sentinel object. Uses whichever provider is configured via STORAGE_PROVIDER
 * (defaults to "local" when unset).
 *
 * Deliberately a real round-trip rather than a `stat`: `stat` only proves a
 * path exists and cannot tell a read-only mount from a writable one, which is
 * the only failure this check exists to catch. The sentinel also works
 * unchanged for S3/R2, where a filesystem permission check means nothing.
 *
 * @returns {Promise<{ status: string, provider: string }>}
 */
export async function checkStorage() {
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
 * queues, so this resolves to null when none are registered and the key is
 * omitted from the report rather than reported as a false pass.
 *
 * @returns {Promise<Record<string, { status: string, waiting?: number, active?: number, failed?: number, message?: string }> | null>}
 */
export async function checkQueues(getRegisteredQueues) {
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

/**
 * Composes the default probe set for a Quark app: the dependencies in
 * `@usequark/quark-core` itself.
 *
 * `pingDatabase` is not imported here — it lives in `@usequark/quark-db`, which
 * depends on this package, so importing it here would be circular. Callers pass
 * it in:
 *
 *   import { pingDatabase } from "@usequark/quark-db";
 *   import { getRegisteredQueues, pingRedis } from "@usequark/quark-core";
 *   import { runHealthChecks, checkStorage, checkQueues } from "@usequark/quark-core/health";
 *
 *   const report = await runHealthChecks({
 *     probes: {
 *       database: pingDatabase,
 *       redis: pingRedis,
 *       storage: checkStorage,
 *       queues: () => checkQueues(getRegisteredQueues),
 *     },
 *   });
 *
 * @param {object} deps
 * @param {() => Promise<object>} deps.pingDatabase
 * @param {() => Promise<object>} [deps.pingRedis]
 * @param {() => Map<string, object>} deps.getRegisteredQueues
 * @returns {Record<string, () => Promise<object>>}
 */
export function createDefaultProbes({
	pingDatabase,
	pingRedis,
	getRegisteredQueues,
}) {
	return {
		database: pingDatabase,
		...(pingRedis ? { redis: pingRedis } : {}),
		storage: checkStorage,
		queues: () => checkQueues(getRegisteredQueues),
	};
}

/**
 * Logs a health report. Useful for startup logging, where the report is wanted
 * in the log stream but not returned to a caller.
 *
 * @param {{ status: string, checks: Record<string, object> }} report
 */
export function logHealthReport(report) {
	logger.info("Health report", {
		status: report.status,
		checks: Object.keys(report.checks ?? {}),
	});
}
