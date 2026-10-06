import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	getRedisEndpoint,
	getRedisUrl,
	resolveRedisConnection,
} from "./redis.js";

describe("getRedisUrl", () => {
	let originalEnv;

	beforeEach(() => {
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("returns REDIS_URL when set", () => {
		process.env.REDIS_URL = "redis://custom:6380";
		delete process.env.REDIS_HOST;
		delete process.env.REDIS_PORT;

		assert.equal(getRedisUrl(), "redis://custom:6380");
	});

	it("builds URL from REDIS_HOST and REDIS_PORT", () => {
		delete process.env.REDIS_URL;
		process.env.REDIS_HOST = "myhost";
		process.env.REDIS_PORT = "6381";

		assert.equal(getRedisUrl(), "redis://myhost:6381");
	});

	it("defaults to localhost:6379", () => {
		delete process.env.REDIS_URL;
		delete process.env.REDIS_HOST;
		delete process.env.REDIS_PORT;

		assert.equal(getRedisUrl(), "redis://localhost:6379");
	});

	it("REDIS_URL takes precedence over REDIS_HOST/REDIS_PORT", () => {
		process.env.REDIS_URL = "redis://from-url:9999";
		process.env.REDIS_HOST = "from-host";
		process.env.REDIS_PORT = "1111";

		assert.equal(getRedisUrl(), "redis://from-url:9999");
	});
});

describe("resolveRedisConnection", () => {
	let originalEnv;

	beforeEach(() => {
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("returns override as-is when provided", () => {
		const override = { host: "custom", port: 1234 };
		assert.deepEqual(resolveRedisConnection(override), override);
	});

	it("parses REDIS_URL into host/port", () => {
		process.env.REDIS_URL = "redis://myredis:6380";
		delete process.env.REDIS_HOST;
		delete process.env.REDIS_PORT;

		const result = resolveRedisConnection();
		assert.equal(result.host, "myredis");
		assert.equal(result.port, 6380);
	});

	it("parses password from REDIS_URL", () => {
		process.env.REDIS_URL = "redis://:s3cret@myredis:6380";
		delete process.env.REDIS_HOST;

		const result = resolveRedisConnection();
		assert.equal(result.host, "myredis");
		assert.equal(result.port, 6380);
		assert.equal(result.password, "s3cret");
	});

	it("decodes URL-encoded password", () => {
		process.env.REDIS_URL = "redis://:p%40ss%3Aword@myredis:6380";
		delete process.env.REDIS_HOST;

		const result = resolveRedisConnection();
		assert.equal(result.password, "p@ss:word");
	});

	it("sets tls for rediss:// protocol", () => {
		process.env.REDIS_URL = "rediss://secure-host:6380";
		delete process.env.REDIS_HOST;

		const result = resolveRedisConnection();
		assert.equal(result.host, "secure-host");
		assert.deepEqual(result.tls, {});
	});

	it("defaults port to 6379 when REDIS_URL omits port", () => {
		process.env.REDIS_URL = "redis://myredis";
		delete process.env.REDIS_HOST;

		const result = resolveRedisConnection();
		assert.equal(result.port, 6379);
	});

	it("falls back to REDIS_HOST/REDIS_PORT when REDIS_URL is absent", () => {
		delete process.env.REDIS_URL;
		process.env.REDIS_HOST = "fallback-host";
		process.env.REDIS_PORT = "7777";

		const result = resolveRedisConnection();
		assert.equal(result.host, "fallback-host");
		assert.equal(result.port, 7777);
		assert.equal(result.password, undefined);
	});

	it("defaults to localhost:6379 when no env vars are set", () => {
		delete process.env.REDIS_URL;
		delete process.env.REDIS_HOST;
		delete process.env.REDIS_PORT;

		const result = resolveRedisConnection();
		assert.equal(result.host, "localhost");
		assert.equal(result.port, 6379);
	});

	it("REDIS_URL takes precedence over REDIS_HOST/REDIS_PORT", () => {
		process.env.REDIS_URL = "redis://url-host:8888";
		process.env.REDIS_HOST = "host-var";
		process.env.REDIS_PORT = "9999";

		const result = resolveRedisConnection();
		assert.equal(result.host, "url-host");
		assert.equal(result.port, 8888);
	});

	it("falls back to REDIS_HOST/REDIS_PORT when REDIS_URL is malformed", () => {
		process.env.REDIS_URL = "not-a-valid-url";
		process.env.REDIS_HOST = "fallback-host";
		process.env.REDIS_PORT = "6382";

		const result = resolveRedisConnection();
		assert.equal(result.host, "fallback-host");
		assert.equal(result.port, 6382);
	});
});

describe("getRedisEndpoint", () => {
	let originalEnv;

	beforeEach(() => {
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("never returns the password from REDIS_URL", () => {
		process.env.REDIS_URL = "redis://default:hunter2@cache.internal:6379";

		const endpoint = getRedisEndpoint();

		assert.equal(endpoint, "cache.internal:6379");
		assert.ok(!endpoint.includes("hunter2"), "endpoint leaked the password");
		assert.ok(!endpoint.includes("default"), "endpoint leaked the username");
	});

	it("never returns a password-only credential", () => {
		process.env.REDIS_URL = "redis://:hunter2@cache.internal:6379";

		const endpoint = getRedisEndpoint();

		assert.equal(endpoint, "cache.internal:6379");
		assert.ok(!endpoint.includes("hunter2"), "endpoint leaked the password");
	});

	it("defaults the port to 6379, or 6380 for rediss://", () => {
		process.env.REDIS_URL = "redis://user:pw@cache.internal";
		assert.equal(getRedisEndpoint(), "cache.internal:6379");

		process.env.REDIS_URL = "rediss://user:pw@secure.internal";
		assert.equal(getRedisEndpoint(), "secure.internal:6380");
	});

	it("reads host and port from REDIS_HOST/REDIS_PORT when REDIS_URL is unset", () => {
		delete process.env.REDIS_URL;
		process.env.REDIS_HOST = "cache.internal";
		process.env.REDIS_PORT = "6390";

		assert.equal(getRedisEndpoint(), "cache.internal:6390");
	});

	it("does not leak a password out of a URL it cannot parse", () => {
		process.env.REDIS_URL = "redis://user:hunter2@cache internal:6379";

		const endpoint = getRedisEndpoint();

		assert.ok(
			!endpoint.includes("hunter2"),
			`unparseable REDIS_URL leaked its password: ${endpoint}`,
		);
	});
});
