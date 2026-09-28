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
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
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

	test("reads AUTH_ALLOW_SIGNUP from env", () => {
		process.env.AUTH_ALLOW_SIGNUP = "false";
		const config = loadConfig();
		assert.strictEqual(config.auth.allowSignup, false);
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
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
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
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
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
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
		assert.throws(() => validateEnv(), /at least 32 characters/);
	});

	test("accepts NEXTAUTH_SECRET of 32+ characters", () => {
		process.env.NEXTAUTH_SECRET = "a".repeat(32);
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
		assert.doesNotThrow(() => validateEnv());
	});

	test("accepts AUTH_SECRET when NEXTAUTH_SECRET is absent", () => {
		delete process.env.NEXTAUTH_SECRET;
		process.env.AUTH_SECRET = "a".repeat(32);
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";

		const validated = validateEnv();
		assert.strictEqual(
			validated.validated.NEXTAUTH_SECRET,
			process.env.AUTH_SECRET,
		);
	});

	test("rejects placeholder AUTH_SECRET values", () => {
		delete process.env.NEXTAUTH_SECRET;
		process.env.AUTH_SECRET = "CHANGE_ME_SUPER_SECRET";
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
		assert.throws(
			() => validateEnv(),
			/AUTH_SECRET contains a placeholder value/,
		);
	});
});

describe("Environment Validation - Umami contract", () => {
	let savedEnv;
	let originalWarn;

	beforeEach(() => {
		savedEnv = { ...process.env };
		originalWarn = console.warn;
		console.warn = () => {};
		resetConfig();
		process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-characters-long";
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
	});

	afterEach(() => {
		console.warn = originalWarn;
		for (const key of Object.keys(process.env)) {
			if (!(key in savedEnv)) delete process.env[key];
		}
		for (const [key, value] of Object.entries(savedEnv)) {
			process.env[key] = value;
		}
		resetConfig();
	});

	test("warns when only one Umami analytics variable is set", () => {
		process.env.NEXT_PUBLIC_UMAMI_URL = "https://stats.example.com";

		const result = validateEnv();

		assert.deepEqual(result.warnings, [
			"Umami analytics is incomplete: set both NEXT_PUBLIC_UMAMI_URL and NEXT_PUBLIC_UMAMI_WEBSITE_ID to enable tracking.",
		]);
	});

	test("rejects invalid Umami website IDs", () => {
		process.env.NEXT_PUBLIC_UMAMI_URL = "https://stats.example.com";
		process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = "website_123";

		assert.throws(
			() => validateEnv(),
			/NEXT_PUBLIC_UMAMI_WEBSITE_ID must be a UUID/,
		);
	});

	test("rejects invalid Umami URLs", () => {
		process.env.NEXT_PUBLIC_UMAMI_URL = "stats.example.com";
		process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = "site_123";

		assert.throws(
			() => validateEnv(),
			/NEXT_PUBLIC_UMAMI_URL must be an absolute http\(s\) URL/,
		);
	});

	test("rejects replay enablement without the full analytics contract", () => {
		process.env.NEXT_PUBLIC_UMAMI_REPLAY_ENABLED = "true";

		assert.throws(
			() => validateEnv(),
			/NEXT_PUBLIC_UMAMI_REPLAY_ENABLED requires NEXT_PUBLIC_UMAMI_URL and NEXT_PUBLIC_UMAMI_WEBSITE_ID/,
		);
	});
});

describe("Environment Validation - canonical origin warnings", () => {
	let savedEnv;
	let originalWarn;

	beforeEach(() => {
		savedEnv = { ...process.env };
		originalWarn = console.warn;
		console.warn = () => {};
		resetConfig();
		process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-characters-long";
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";
		process.env.REDIS_HOST = "localhost";
	});

	afterEach(() => {
		console.warn = originalWarn;
		for (const key of Object.keys(process.env)) {
			if (!(key in savedEnv)) delete process.env[key];
		}
		for (const [key, value] of Object.entries(savedEnv)) {
			process.env[key] = value;
		}
		resetConfig();
	});

	test("warns when APP_URL is missing in production", () => {
		process.env.NODE_ENV = "production";
		process.env.APP_DESCRIPTION = "A test application";
		delete process.env.APP_URL;
		delete process.env.NEXTAUTH_URL;

		const result = validateEnv();

		assert.deepEqual(result.warnings, [
			"APP_URL not set: Auth.js and CORS origins will fall back to http://localhost. Set APP_URL to your real https origin before production.",
		]);
	});

	test("does not warn about APP_URL when it is set in production", () => {
		process.env.NODE_ENV = "production";
		process.env.APP_DESCRIPTION = "A test application";
		process.env.APP_URL = "https://myapp.com";

		const result = validateEnv();

		assert.deepEqual(result.warnings, []);
	});

	test("does not warn about APP_URL outside production", () => {
		process.env.NODE_ENV = "development";
		process.env.APP_DESCRIPTION = "A test application";
		delete process.env.APP_URL;

		const result = validateEnv();

		assert.ok(
			!result.warnings.some((w) => w.startsWith("APP_URL not set")),
			`unexpected APP_URL warning in development: ${result.warnings}`,
		);
	});
});
