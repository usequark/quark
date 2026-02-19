/**
 * @techstream/quark-config - Configuration Loader
 * Centralised configuration management that combines environment validation,
 * environment-specific defaults, and user overrides into a single config object.
 *
 * Usage:
 *   import { loadConfig } from "@techstream/quark-config";
 *   const config = loadConfig();          // validates env + returns typed config
 *   const config = loadConfig({ cache: { defaultTtl: 120 } }); // with overrides
 */

import { getAllowedOrigins, getAppUrl } from "./app-url.js";
import { getEnvironmentConfig, mergeConfig } from "./environment.js";
import { validateEnv } from "./validate-env.js";

/** @type {import("./environment.js").EnvironmentConfig | null} */
let cachedConfig = null;

/**
 * Loads the full application configuration.
 *
 * 1. Validates all required environment variables (throws on failure).
 * 2. Resolves the current environment (dev/test/staging/production).
 * 3. Merges environment-specific defaults with any user overrides.
 * 4. Enriches with computed values (APP_URL, allowed origins, ports).
 * 5. Caches the result — subsequent calls return the same object.
 *
 * @param {Record<string, unknown>} [overrides] - Optional partial overrides
 * @param {Object} [options]
 * @param {boolean} [options.fresh=false] - Force re-computation (bypass cache)
 * @returns {import("./environment.js").EnvironmentConfig & { appUrl: string, allowedOrigins: string[], validated: Record<string, string> }}
 */
export function loadConfig(overrides = {}, options = {}) {
	if (cachedConfig && !options.fresh) {
		return cachedConfig;
	}

	// Step 1: Validate environment variables
	const { validated } = validateEnv();

	// Step 2: Resolve environment and get defaults
	const envConfig = getEnvironmentConfig();

	// Step 3: Apply env-var driven overrides
	const envOverrides = buildEnvOverrides(envConfig);

	// Step 4: Merge: env defaults → env-var overrides → user overrides
	let config = mergeConfig(envConfig, envOverrides);
	config = mergeConfig(config, overrides);

	// Step 5: Attach computed values
	config.appUrl = getAppUrl();
	config.allowedOrigins = getAllowedOrigins();
	config.validated = validated;

	cachedConfig = config;
	return config;
}

/**
 * Clears the cached configuration. Useful in tests.
 */
export function resetConfig() {
	cachedConfig = null;
}

/**
 * Returns the cached configuration if already loaded, otherwise null.
 * Does NOT trigger validation — use `loadConfig()` for that.
 * @returns {ReturnType<typeof loadConfig> | null}
 */
export function getConfig() {
	return cachedConfig;
}

/**
 * Reads specific environment variables and converts them to config overrides.
 * This allows env vars to take precedence over environment defaults.
 *
 * @param {import("./environment.js").EnvironmentConfig} envConfig
 * @returns {Record<string, unknown>}
 */
function buildEnvOverrides(_envConfig) {
	const overrides = {};

	// Server
	if (process.env.PORT) {
		const port = Number.parseInt(process.env.PORT, 10);
		if (!Number.isNaN(port)) overrides.server = { port };
	}

	// Rate limiting
	if (process.env.RATE_LIMIT_MAX) {
		const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX, 10);
		if (!Number.isNaN(maxRequests)) {
			overrides.rateLimit = { ...overrides.rateLimit, maxRequests };
		}
	}
	if (process.env.RATE_LIMIT_WINDOW_MS) {
		const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10);
		if (!Number.isNaN(windowMs)) {
			overrides.rateLimit = { ...overrides.rateLimit, windowMs };
		}
	}

	// Cache
	if (process.env.CACHE_TTL) {
		const defaultTtl = Number.parseInt(process.env.CACHE_TTL, 10);
		if (!Number.isNaN(defaultTtl)) overrides.cache = { defaultTtl };
	}

	// Logging
	if (process.env.LOG_LEVEL) {
		overrides.logging = { ...overrides.logging, level: process.env.LOG_LEVEL };
	}

	// Database pool
	if (process.env.DB_POOL_MAX) {
		const poolMax = Number.parseInt(process.env.DB_POOL_MAX, 10);
		if (!Number.isNaN(poolMax)) {
			overrides.db = { ...overrides.db, poolMax };
		}
	}
	if (process.env.DB_POOL_IDLE_TIMEOUT) {
		const poolIdleTimeout = Number.parseInt(
			process.env.DB_POOL_IDLE_TIMEOUT,
			10,
		);
		if (!Number.isNaN(poolIdleTimeout)) {
			overrides.db = { ...overrides.db, poolIdleTimeout };
		}
	}

	return overrides;
}
