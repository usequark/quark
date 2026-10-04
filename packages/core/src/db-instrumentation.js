/**
 * @usequark/quark-core — Database Instrumentation Module
 *
 * Schema-agnostic Prisma $extends middleware that monitors query execution
 * times and logs slow queries. All query arguments are automatically masked
 * to prevent sensitive data (passwords, tokens, hashes) from reaching logs.
 *
 * Agnostic by design: no project-specific thresholds or resource limits are
 * hardcoded. All configuration comes from environment variables.
 *
 * Usage in client.js:
 *
 *   import { createDbInstrumentation } from "@usequark/quark-core";
 *   const base = new PrismaClient({ ... });
 *   const ext = createDbInstrumentation();
 *   if (ext) prisma = base.$extends(ext);
 */

import { createLogger } from "./logger.js";

const log = createLogger("db:instrumentation");

// ── Sensitive field patterns — anything matching is redacted ────────
const SENSITIVE_FIELD_PATTERNS = [
	/^passw(?:or)?d$/i,
	/^secret$/i,
	/^token$/i,
	/^api[_-]?key/i,
	/^auth[_-]?token/i,
	/^refresh[_-]?token/i,
	/^access[_-]?token/i,
	/^session[_-]?token/i,
	/^reset[_-]?token/i,
	/^verify[_-]?token/i,
	/^csrf[_-]?token/i,
	/^hash(?:ed)?$/i,
	/^pin$/i,
	/^otp$/i,
	/^otp[_-]?secret$/i,
	/^totp[_-]?secret$/i,
	/^recovery[_-]?code/i,
	/^private[_-]?key/i,
	/^ssh[_-]?key/i,
	/^pem$/i,
	/^certificate$/i,
	/^id[_-]?token/i,
	/^code[_-]?verifier$/i,
	/^code[_-]?challenge$/i,
	/^nonce$/i,
	/^signature$/i,
	/^bearer$/i,
	/^authorization$/i,
	/^cookie$/i,
	/^set[_-]?cookie/i,
	/^x[_-]?csrf[_-]?token/i,
	/^x[_-]?xsrf[_-]?token/i,
	/^stripe[_-]?secret/i,
	/^stripe[_-]?key/i,
];

/** Value that appears in logs in place of a redacted field. */
const REDACTED_PLACEHOLDER = "[REDACTED]";

/** Default slow-query threshold in milliseconds. */
const DEFAULT_SLOW_THRESHOLD_MS = 500;

/**
 * Returns the slow-query threshold from env, falling back to the default.
 * @returns {number}
 */
function getSlowThreshold() {
	const fromEnv = Number(process.env.DB_SLOW_QUERY_THRESHOLD);
	return Number.isFinite(fromEnv) && fromEnv > 0
		? fromEnv
		: DEFAULT_SLOW_THRESHOLD_MS;
}

/**
 * Returns true if instrumentation is enabled via environment variable.
 * @returns {boolean}
 */
function isInstrumentationEnabled() {
	const setting = process.env.DB_INSTRUMENTATION;
	if (setting === "0" || setting === "false" || setting === "off") return false;
	return true;
}

// ── Argument masking ───────────────────────────────────────────────

/**
 * Recursively walks a value and replaces any key that matches a
 * sensitive-field pattern with a placeholder.  Handles nested objects,
 * arrays, and primitive values safely.
 *
 * @param {unknown} value — The value to mask.
 * @returns {unknown} — The masked copy (shallow clone for non-objects).
 */
function maskSensitiveValues(value) {
	// Primitives pass through as-is (leaf values that happen to be strings
	// are not masked — we only mask *keys* named like sensitive fields).
	if (value === null || value === undefined || typeof value !== "object") {
		return value;
	}

	// Arrays — recurse into each element.
	if (Array.isArray(value)) {
		return value.map(maskSensitiveValues);
	}

	// Plain object — clone and mask matching keys.
	const masked = /** @type {Record<string, unknown>} */ ({});
	for (const [key, val] of Object.entries(
		/** @type {Record<string, unknown>} */ (value),
	)) {
		if (isSensitiveKey(key)) {
			masked[key] = REDACTED_PLACEHOLDER;
		} else {
			masked[key] = maskSensitiveValues(val);
		}
	}
	return masked;
}

/**
 * Checks whether a key name matches any sensitive-field pattern.
 * @param {string} key
 * @returns {boolean}
 */
function isSensitiveKey(key) {
	return SENSITIVE_FIELD_PATTERNS.some((re) => re.test(key));
}

// ── Query-log argument summarisation ───────────────────────────────

/**
 * Produces a safe, compact summary of query arguments suitable for
 * debug-level logging.  Masks sensitive fields and truncates large
 * structures.
 *
 * @param {unknown} args — The raw Prisma query args.
 * @returns {Record<string, unknown>}
 */
function summarizeArgs(args) {
	if (!args || typeof args !== "object") return {};

	const masked = maskSensitiveValues(args);

	// Truncate "data" and "where" large blocks to avoid log spam.
	if (masked.data && typeof masked.data === "object") {
		masked.data = truncateDeep(masked.data, 3);
	}
	if (masked.where && typeof masked.where === "object") {
		masked.where = truncateDeep(masked.where, 3);
	}
	return /** @type {Record<string, unknown>} */ (masked);
}

/**
 * Deep-truncates an object: keeps at most `maxKeys` keys per level.
 * Beyond the limit, a `[+N more]` marker is added.
 *
 * @param {Record<string, unknown>} obj
 * @param {number} maxKeys
 * @returns {Record<string, unknown>}
 */
function truncateDeep(obj, maxKeys) {
	if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;

	const keys = Object.keys(obj);
	if (keys.length <= maxKeys) {
		const result = /** @type {Record<string, unknown>} */ ({});
		for (const key of keys) {
			result[key] =
				typeof obj[key] === "object" && obj[key] !== null
					? truncateDeep(
							/** @type {Record<string, unknown>} */ (obj[key]),
							maxKeys,
						)
					: obj[key];
		}
		return result;
	}

	const result = /** @type {Record<string, unknown>} */ ({});
	const kept = keys.slice(0, maxKeys);
	for (const key of kept) {
		result[key] =
			typeof obj[key] === "object" && obj[key] !== null
				? truncateDeep(
						/** @type {Record<string, unknown>} */ (obj[key]),
						maxKeys,
					)
				: obj[key];
	}
	result[`[+${keys.length - maxKeys} more]`] = true;
	return result;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Creates a Prisma client extension object that instruments all queries.
 *
 * The extension wraps every Prisma operation to:
 *  1. Measure execution duration.
 *  2. Log slow queries (configurable via DB_SLOW_QUERY_THRESHOLD).
 *  3. Mask sensitive fields in all log output.
 *  4. Increment Prometheus metrics for query counts and durations.
 *
 * Returns `null` when DB_INSTRUMENTATION is explicitly disabled, so the
 * caller can skip the $extends call entirely (zero overhead).
 *
 * @returns {import("@prisma/client").PrismaClientExtended | null}
 */
export function createDbInstrumentation() {
	if (!isInstrumentationEnabled()) return null;

	const slowThreshold = getSlowThreshold();

	return {
		name: "quark-db-instrumentation",
		query: {
			/**
			 * Middleware invoked for every Prisma operation.
			 * @param {Object} params
			 * @param {string} params.model — Model name (e.g. "User", "Account")
			 * @param {string} params.operation — Operation name (e.g. "findUnique", "create")
			 * @param {unknown} params.args — Query arguments (masked before logging)
			 * @param {Function} params.query — The inner query function to call
			 * @returns {Promise<unknown>}
			 */
			async $allOperations({ model, operation, args, query }) {
				const start = performance.now();

				try {
					const result = await query(args);
					return result;
				} finally {
					const durationMs = performance.now() - start;

					// Emit Prometheus metrics (best-effort, no throw)
					try {
						const { dbQueriesTotal, dbQueryDuration } = await import(
							"./db-metrics.js"
						);
						dbQueriesTotal.inc({ model, operation });
						dbQueryDuration.observe({ model, operation }, durationMs / 1000);
					} catch {
						// Metrics registry not registered — skip silently.
					}

					// Slow-query warning (masked args, no sensitive data)
					if (durationMs > slowThreshold) {
						log.warn("Slow query detected", {
							model,
							operation,
							durationMs: Math.round(durationMs),
							args: summarizeArgs(args),
						});
					} else if (process.env.LOG_LEVEL === "debug") {
						log.debug("Query executed", {
							model,
							operation,
							durationMs: Math.round(durationMs),
							args: summarizeArgs(args),
						});
					}
				}
			},
		},
	};
}

// Re-export for testing
export {
	getSlowThreshold,
	isSensitiveKey,
	maskSensitiveValues,
	REDACTED_PLACEHOLDER,
	summarizeArgs,
};
