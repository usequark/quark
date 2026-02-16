import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	ENVIRONMENTS,
	getEnvironmentConfig,
	mergeConfig,
	resolveEnvironment,
} from "./environment.js";

describe("Environment - resolveEnvironment", () => {
	let originalNodeEnv;

	beforeEach(() => {
		originalNodeEnv = process.env.NODE_ENV;
	});

	afterEach(() => {
		if (originalNodeEnv !== undefined) {
			process.env.NODE_ENV = originalNodeEnv;
		} else {
			delete process.env.NODE_ENV;
		}
	});

	test("resolves 'development' from NODE_ENV", () => {
		assert.strictEqual(resolveEnvironment("development"), "development");
	});

	test("resolves 'production' from NODE_ENV", () => {
		assert.strictEqual(resolveEnvironment("production"), "production");
	});

	test("resolves 'test' from NODE_ENV", () => {
		assert.strictEqual(resolveEnvironment("test"), "test");
	});

	test("resolves 'staging' from NODE_ENV", () => {
		assert.strictEqual(resolveEnvironment("staging"), "staging");
	});

	test("resolves alias 'dev' to 'development'", () => {
		assert.strictEqual(resolveEnvironment("dev"), "development");
	});

	test("resolves alias 'prod' to 'production'", () => {
		assert.strictEqual(resolveEnvironment("prod"), "production");
	});

	test("resolves alias 'stage' to 'staging'", () => {
		assert.strictEqual(resolveEnvironment("stage"), "staging");
	});

	test("resolves alias 'testing' to 'test'", () => {
		assert.strictEqual(resolveEnvironment("testing"), "test");
	});

	test("is case-insensitive", () => {
		assert.strictEqual(resolveEnvironment("PRODUCTION"), "production");
		assert.strictEqual(resolveEnvironment("Development"), "development");
	});

	test("trims whitespace", () => {
		assert.strictEqual(resolveEnvironment("  production  "), "production");
	});

	test("defaults to development when unrecognized", () => {
		assert.strictEqual(resolveEnvironment("unknown"), "development");
	});

	test("defaults to development when empty", () => {
		assert.strictEqual(resolveEnvironment(""), "development");
	});

	test("reads from process.env.NODE_ENV when no argument given", () => {
		process.env.NODE_ENV = "production";
		assert.strictEqual(resolveEnvironment(), "production");
	});

	test("defaults to development when NODE_ENV is unset", () => {
		delete process.env.NODE_ENV;
		assert.strictEqual(resolveEnvironment(), "development");
	});
});

describe("Environment - getEnvironmentConfig", () => {
	test("returns development config", () => {
		const config = getEnvironmentConfig("development");
		assert.strictEqual(config.environment, "development");
		assert.strictEqual(config.isDevelopment, true);
		assert.strictEqual(config.isProduction, false);
		assert.strictEqual(config.isTest, false);
	});

	test("returns test config", () => {
		const config = getEnvironmentConfig("test");
		assert.strictEqual(config.environment, "test");
		assert.strictEqual(config.isTest, true);
		assert.strictEqual(config.logging.level, "warn");
	});

	test("returns staging config", () => {
		const config = getEnvironmentConfig("staging");
		assert.strictEqual(config.environment, "staging");
		assert.strictEqual(config.isProduction, true);
		assert.strictEqual(config.security.enforceHttps, true);
	});

	test("returns production config", () => {
		const config = getEnvironmentConfig("production");
		assert.strictEqual(config.environment, "production");
		assert.strictEqual(config.isProduction, true);
		assert.strictEqual(config.features.debugRoutes, false);
		assert.strictEqual(config.features.detailedErrors, false);
	});

	test("development has higher rate limits than production", () => {
		const dev = getEnvironmentConfig("development");
		const prod = getEnvironmentConfig("production");
		assert.ok(dev.rateLimit.maxRequests > prod.rateLimit.maxRequests);
	});

	test("test disables cache TTL", () => {
		const config = getEnvironmentConfig("test");
		assert.strictEqual(config.cache.defaultTtl, 0);
	});

	test("test has high rate limits to avoid test interference", () => {
		const config = getEnvironmentConfig("test");
		assert.ok(config.rateLimit.maxRequests >= 10_000);
	});

	test("development enables detailed errors", () => {
		const config = getEnvironmentConfig("development");
		assert.strictEqual(config.features.detailedErrors, true);
	});

	test("production disables debug routes", () => {
		const config = getEnvironmentConfig("production");
		assert.strictEqual(config.features.debugRoutes, false);
	});

	test("development uses lower DB pool size", () => {
		const dev = getEnvironmentConfig("development");
		const prod = getEnvironmentConfig("production");
		assert.ok(dev.db.poolMax < prod.db.poolMax);
	});

	test("returns a copy (not a reference)", () => {
		const a = getEnvironmentConfig("development");
		const b = getEnvironmentConfig("development");
		assert.notStrictEqual(a, b);
	});

	test("production uses JSON logging", () => {
		const config = getEnvironmentConfig("production");
		assert.strictEqual(config.logging.json, true);
	});

	test("development uses non-JSON logging", () => {
		const config = getEnvironmentConfig("development");
		assert.strictEqual(config.logging.json, false);
	});
});

describe("Environment - mergeConfig", () => {
	test("overrides top-level scalar values", () => {
		const base = getEnvironmentConfig("development");
		const result = mergeConfig(base, { environment: "custom" });
		assert.strictEqual(result.environment, "custom");
	});

	test("shallow-merges nested objects", () => {
		const base = getEnvironmentConfig("development");
		const result = mergeConfig(base, { rateLimit: { maxRequests: 500 } });
		assert.strictEqual(result.rateLimit.maxRequests, 500);
		// Other rateLimit properties preserved
		assert.strictEqual(result.rateLimit.windowMs, base.rateLimit.windowMs);
	});

	test("does not mutate the base config", () => {
		const base = getEnvironmentConfig("development");
		const originalPort = base.server.port;
		mergeConfig(base, { server: { port: 9999 } });
		assert.strictEqual(base.server.port, originalPort);
	});

	test("handles empty overrides", () => {
		const base = getEnvironmentConfig("production");
		const result = mergeConfig(base, {});
		assert.deepStrictEqual(result.logging, base.logging);
	});
});

describe("Environment - ENVIRONMENTS constant", () => {
	test("contains all four environments", () => {
		assert.deepStrictEqual(
			[...ENVIRONMENTS],
			["development", "test", "staging", "production"],
		);
	});
});
