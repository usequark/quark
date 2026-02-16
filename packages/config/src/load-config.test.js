import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import { getConfig, loadConfig, resetConfig } from "./load-config.js";
import { validateEnv } from "./validate-env.js";

describe("Configuration Loader - loadConfig", () => {
	let savedEnv;

	beforeEach(() => {
		savedEnv = { ...process.env };
		// Ensure required env vars are present
		process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-characters-long";
		resetConfig();
	});

	afterEach(() => {
		// Restore env
		for (const key of Object.keys(process.env)) {
			if (!(key in savedEnv)) {
				delete process.env[key];
			}
		}
		for (const [key, value] of Object.entries(savedEnv)) {
			process.env[key] = value;
		}
		resetConfig();
	});

	test("returns a config object with environment field", () => {
		const config = loadConfig();
		assert.ok(config.environment);
		assert.ok(
			["development", "test", "staging", "production"].includes(
				config.environment,
			),
		);
	});

	test("includes appUrl", () => {
		const config = loadConfig();
		assert.ok(typeof config.appUrl === "string");
		assert.ok(config.appUrl.startsWith("http"));
	});

	test("includes allowedOrigins array", () => {
		const config = loadConfig();
		assert.ok(Array.isArray(config.allowedOrigins));
		assert.ok(config.allowedOrigins.length > 0);
	});

	test("includes validated env vars", () => {
		const config = loadConfig();
		assert.ok(typeof config.validated === "object");
		assert.ok(config.validated.NEXTAUTH_SECRET);
	});

	test("caches result on subsequent calls", () => {
		const first = loadConfig();
		const second = loadConfig();
		assert.strictEqual(first, second);
	});

	test("fresh option bypasses cache", () => {
		const first = loadConfig();
		const second = loadConfig({}, { fresh: true });
		assert.notStrictEqual(first, second);
	});

	test("accepts user overrides", () => {
		const config = loadConfig({ cache: { defaultTtl: 999 } });
		assert.strictEqual(config.cache.defaultTtl, 999);
	});

	test("user overrides do not mutate environment defaults", () => {
		loadConfig({ server: { port: 9999 } });
		resetConfig();
		const fresh = loadConfig();
		assert.notStrictEqual(fresh.server.port, 9999);
	});

	test("reads PORT from env", () => {
		process.env.PORT = "4000";
		const config = loadConfig();
		assert.strictEqual(config.server.port, 4000);
	});

	test("reads RATE_LIMIT_MAX from env", () => {
		process.env.RATE_LIMIT_MAX = "200";
		const config = loadConfig();
		assert.strictEqual(config.rateLimit.maxRequests, 200);
	});

	test("reads LOG_LEVEL from env", () => {
		process.env.LOG_LEVEL = "error";
		const config = loadConfig();
		assert.strictEqual(config.logging.level, "error");
	});

	test("reads DB_POOL_MAX from env", () => {
		process.env.DB_POOL_MAX = "20";
		const config = loadConfig();
		assert.strictEqual(config.db.poolMax, 20);
	});

	test("reads CACHE_TTL from env", () => {
		process.env.CACHE_TTL = "300";
		const config = loadConfig();
		assert.strictEqual(config.cache.defaultTtl, 300);
	});

	test("user overrides take precedence over env vars", () => {
		process.env.PORT = "4000";
		const config = loadConfig({ server: { port: 5000 } });
		assert.strictEqual(config.server.port, 5000);
	});

	test("ignores non-numeric PORT env var", () => {
		process.env.PORT = "abc";
		const config = loadConfig();
		// Should use environment default, not NaN
		assert.ok(!Number.isNaN(config.server.port));
	});

	test("ignores non-numeric RATE_LIMIT_MAX env var", () => {
		process.env.RATE_LIMIT_MAX = "notanumber";
		const config = loadConfig();
		assert.ok(!Number.isNaN(config.rateLimit.maxRequests));
	});

	test("ignores non-numeric DB_POOL_MAX env var", () => {
		process.env.DB_POOL_MAX = "";
		const config = loadConfig();
		assert.ok(!Number.isNaN(config.db.poolMax));
	});
});

describe("Configuration Loader - resetConfig", () => {
	beforeEach(() => {
		process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-characters-long";
		resetConfig();
	});

	afterEach(() => {
		resetConfig();
	});

	test("clears cached config", () => {
		loadConfig();
		assert.ok(getConfig() !== null);
		resetConfig();
		assert.strictEqual(getConfig(), null);
	});
});

describe("Configuration Loader - getConfig", () => {
	beforeEach(() => {
		process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-characters-long";
		resetConfig();
	});

	afterEach(() => {
		resetConfig();
	});

	test("returns null before loadConfig is called", () => {
		assert.strictEqual(getConfig(), null);
	});

	test("returns cached config after loadConfig is called", () => {
		const loaded = loadConfig();
		assert.strictEqual(getConfig(), loaded);
	});
});

describe("Environment Validation - NEXTAUTH_SECRET strength", () => {
	let savedEnv;

	beforeEach(() => {
		savedEnv = { ...process.env };
		resetConfig();
	});

	afterEach(() => {
		for (const key of Object.keys(process.env)) {
			if (!(key in savedEnv)) delete process.env[key];
		}
		for (const [key, value] of Object.entries(savedEnv)) {
			process.env[key] = value;
		}
		resetConfig();
	});

	test("rejects NEXTAUTH_SECRET shorter than 32 characters", () => {
		process.env.NEXTAUTH_SECRET = "too-short";
		assert.throws(() => validateEnv(), /at least 32 characters/);
	});

	test("accepts NEXTAUTH_SECRET of 32+ characters", () => {
		process.env.NEXTAUTH_SECRET = "a".repeat(32);
		assert.doesNotThrow(() => validateEnv());
	});
});
