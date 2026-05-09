/**
 * @techstream/quark-config - Environment Configuration
 * Provides environment-specific defaults for dev, test, staging, and production.
 * Each environment defines sensible defaults that can be overridden via env vars.
 */

/**
 * @typedef {"development" | "test" | "staging" | "production"} Environment
 *
 * @typedef {Object} EnvironmentConfig
 * @property {Environment} environment - Resolved environment name
 * @property {boolean} isProduction - True in production and staging
 * @property {boolean} isDevelopment - True in development
 * @property {boolean} isTest - True in test
 * @property {Object} server - Server configuration
 * @property {number} server.port - HTTP port
 * @property {Object} rateLimit - Rate limiting defaults
 * @property {number} rateLimit.windowMs - Rate limit window in ms
 * @property {number} rateLimit.maxRequests - Max requests per window
 * @property {number} rateLimit.authMaxRequests - Max auth requests per window
 * @property {Object} cache - Cache configuration
 * @property {number} cache.defaultTtl - Default cache TTL in seconds
 * @property {Object} logging - Logging configuration
 * @property {string} logging.level - Minimum log level
 * @property {boolean} logging.json - Use JSON format
 * @property {Object} db - Database configuration
 * @property {number} db.poolMax - Max DB pool connections
 * @property {number} db.poolIdleTimeout - Idle timeout in seconds
 * @property {number} db.connectionTimeout - Connection timeout in seconds
 * @property {Object} email - Email configuration
 * @property {number} email.timeout - SMTP/API timeout in ms
 * @property {Object} security - Security configuration
 * @property {boolean} security.enforceHttps - Require HTTPS
 * @property {boolean} security.trustProxy - Trust proxy headers
 * @property {Object} auth - Authentication configuration
 * @property {boolean} auth.allowSignup - Allow public self-service signup
 * @property {Object} features - Feature flags
 * @property {boolean} features.debugRoutes - Enable debug endpoints
 * @property {boolean} features.seedOnStart - Auto-seed database on startup
 * @property {boolean} features.detailedErrors - Include stack traces in error responses
 */

/** @type {Record<Environment, EnvironmentConfig>} */
const ENVIRONMENT_CONFIGS = {
	development: {
		environment: "development",
		isProduction: false,
		isDevelopment: true,
		isTest: false,
		server: {
			port: 3000,
		},
		rateLimit: {
			windowMs: 15 * 60 * 1000,
			maxRequests: 1000,
			authMaxRequests: 50,
		},
		cache: {
			defaultTtl: 60,
		},
		logging: {
			level: "debug",
			json: false,
		},
		db: {
			poolMax: 5,
			poolIdleTimeout: 30,
			connectionTimeout: 5,
		},
		email: {
			timeout: 10_000,
		},
		security: {
			enforceHttps: false,
			trustProxy: false,
		},
		auth: {
			allowSignup: true,
		},
		features: {
			debugRoutes: true,
			seedOnStart: false,
			detailedErrors: true,
		},
	},

	test: {
		environment: "test",
		isProduction: false,
		isDevelopment: false,
		isTest: true,
		server: {
			port: 3001,
		},
		rateLimit: {
			windowMs: 15 * 60 * 1000,
			maxRequests: 10_000,
			authMaxRequests: 10_000,
		},
		cache: {
			defaultTtl: 0,
		},
		logging: {
			level: "warn",
			json: false,
		},
		db: {
			poolMax: 3,
			poolIdleTimeout: 10,
			connectionTimeout: 5,
		},
		email: {
			timeout: 5_000,
		},
		security: {
			enforceHttps: false,
			trustProxy: false,
		},
		auth: {
			allowSignup: true,
		},
		features: {
			debugRoutes: true,
			seedOnStart: false,
			detailedErrors: true,
		},
	},

	staging: {
		environment: "staging",
		isProduction: true,
		isDevelopment: false,
		isTest: false,
		server: {
			port: 3000,
		},
		rateLimit: {
			windowMs: 15 * 60 * 1000,
			maxRequests: 100,
			authMaxRequests: 5,
		},
		cache: {
			defaultTtl: 300,
		},
		logging: {
			level: "info",
			json: true,
		},
		db: {
			poolMax: 10,
			poolIdleTimeout: 30,
			connectionTimeout: 5,
		},
		email: {
			timeout: 10_000,
		},
		security: {
			enforceHttps: true,
			trustProxy: true,
		},
		auth: {
			allowSignup: true,
		},
		features: {
			debugRoutes: false,
			seedOnStart: false,
			detailedErrors: false,
		},
	},

	production: {
		environment: "production",
		isProduction: true,
		isDevelopment: false,
		isTest: false,
		server: {
			port: 3000,
		},
		rateLimit: {
			windowMs: 15 * 60 * 1000,
			maxRequests: 100,
			authMaxRequests: 5,
		},
		cache: {
			defaultTtl: 600,
		},
		logging: {
			level: "info",
			json: true,
		},
		db: {
			poolMax: 10,
			poolIdleTimeout: 30,
			connectionTimeout: 5,
		},
		email: {
			timeout: 10_000,
		},
		security: {
			enforceHttps: true,
			trustProxy: true,
		},
		auth: {
			allowSignup: true,
		},
		features: {
			debugRoutes: false,
			seedOnStart: false,
			detailedErrors: false,
		},
	},
};

/** Valid environment names */
export const ENVIRONMENTS = /** @type {const} */ ([
	"development",
	"test",
	"staging",
	"production",
]);

/**
 * Resolves the current environment from NODE_ENV.
 * Maps common aliases (e.g. "dev" → "development", "prod" → "production").
 * Defaults to "development" if unset or unrecognized.
 *
 * @param {string} [nodeEnv] - Override for NODE_ENV (defaults to process.env.NODE_ENV)
 * @returns {Environment}
 */
export function resolveEnvironment(nodeEnv) {
	const raw = (nodeEnv ?? process.env.NODE_ENV ?? "").toLowerCase().trim();

	const aliases = {
		dev: "development",
		development: "development",
		test: "test",
		testing: "test",
		staging: "staging",
		stage: "staging",
		prod: "production",
		production: "production",
	};

	return aliases[raw] || "development";
}

/**
 * Returns the full environment configuration for a given environment.
 * Unknown environments fall back to development.
 *
 * @param {string} [nodeEnv] - Override for NODE_ENV
 * @returns {EnvironmentConfig}
 */
export function getEnvironmentConfig(nodeEnv) {
	const env = resolveEnvironment(nodeEnv);
	return { ...ENVIRONMENT_CONFIGS[env] };
}

/**
 * Shallow-merges environment config with user-provided overrides (one level deep).
 * Top-level scalars are replaced; top-level objects are spread-merged.
 * Useful when downstream apps need to adjust defaults per-environment.
 *
 * @param {EnvironmentConfig} base - Base environment config
 * @param {Record<string, unknown>} overrides - Partial overrides to merge
 * @returns {EnvironmentConfig}
 */
export function mergeConfig(base, overrides) {
	const result = { ...base };
	for (const [key, value] of Object.entries(overrides)) {
		if (
			value != null &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			typeof result[key] === "object" &&
			result[key] != null
		) {
			result[key] = { ...result[key], ...value };
		} else {
			result[key] = value;
		}
	}
	return result;
}
