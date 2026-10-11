import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest } from "next/server.js";

/** What the stubbed `ioredis` client's `eval()` does for the current test. */
let redisEvalImpl;

// ioredis is CJS; proxy.js reads `const { default: Redis } = await import(...)`.
// Provide both shapes so the interop can't resolve to undefined.
class StubRedis {
	constructor(url) {
		this.url = url;
	}
	on() {}
	async eval(...args) {
		return redisEvalImpl(...args);
	}
}

mock.module("ioredis", {
	exports: { default: StubRedis },
});

const { __resetRateLimiterForTests, getRateLimiter, proxy } = await import(
	"./proxy.js"
);

beforeEach(() => {
	// A working Redis: first hit in a window returns count 1, ttl = window.
	redisEvalImpl = async () => [1, 60000];
	__resetRateLimiterForTests();
});

// The auth bucket allows 5 requests per window; `api` allows 100.
const AUTH_ROUTE = "/api/auth/callback/credentials";

function authRequest(forwardedIp) {
	return new NextRequest(`http://localhost:3005${AUTH_ROUTE}`, {
		method: "POST",
		headers: {
			"x-forwarded-for": forwardedIp,
			"content-length": "0",
		},
	});
}

test("rate limits key on the forwarded client IP, not a shared bucket", async () => {
	const limitedIp = "203.0.113.10";
	const otherIp = "203.0.113.20";

	// Exhaust this client's auth bucket (limit is 5 per window).
	for (let i = 0; i < 5; i++) {
		const response = await proxy(authRequest(limitedIp));
		assert.notEqual(
			response.status,
			429,
			`request ${i + 1} from ${limitedIp} should be allowed`,
		);
	}

	const limited = await proxy(authRequest(limitedIp));
	assert.equal(limited.status, 429, `${limitedIp} should now be rate limited`);
	assert.equal(limited.headers.get("X-RateLimit-Limit"), "5");

	// A different client must not inherit the exhausted bucket. Before getClientIp
	// every request collapsed onto the literal key "unknown" and shared one bucket.
	const other = await proxy(authRequest(otherIp));
	assert.notEqual(
		other.status,
		429,
		`${otherIp} must not be rate limited by ${limitedIp}'s traffic`,
	);
});

test("falls back to x-real-ip when x-forwarded-for is absent", async () => {
	const realIp = "198.51.100.7";

	const first = await proxy(
		new NextRequest("http://localhost:3005/api/auth/register", {
			method: "POST",
			headers: { "x-real-ip": realIp, "content-length": "0" },
		}),
	);
	assert.notEqual(first.status, 429);

	for (let i = 0; i < 4; i++) {
		await proxy(
			new NextRequest("http://localhost:3005/api/auth/register", {
				method: "POST",
				headers: { "x-real-ip": realIp, "content-length": "0" },
			}),
		);
	}

	const limited = await proxy(
		new NextRequest("http://localhost:3005/api/auth/register", {
			method: "POST",
			headers: { "x-real-ip": realIp, "content-length": "0" },
		}),
	);
	assert.equal(limited.status, 429, `${realIp} should be rate limited`);
});

test("never rate limits /api/health", async () => {
	const healthIp = "198.51.100.30";
	const healthRequest = () =>
		new NextRequest("http://localhost:3005/api/health", {
			headers: { "x-forwarded-for": healthIp },
		});

	// The `api` bucket allows 100 per window. Burning through it and then some
	// must not stop the healthcheck: a probe that gets a 429 reads as unhealthy
	// and makes the orchestrator restart the container.
	for (let i = 0; i < 250; i++) {
		const response = await proxy(healthRequest());
		assert.notEqual(response.status, 429, `probe ${i + 1} was rate limited`);
	}
});

test("a rate-limited client can still be probed for health", async () => {
	const ip = "198.51.100.31";
	const apiRequest = (path) =>
		new NextRequest(`http://localhost:3005${path}`, {
			method: "POST",
			headers: { "x-forwarded-for": ip, "content-length": "0" },
		});

	// Exhaust the `api` bucket from this client (limit is 100 per window).
	for (let i = 0; i < 100; i++) {
		await proxy(apiRequest("/api/upload"));
	}

	const limited = await proxy(apiRequest("/api/upload"));
	assert.equal(limited.status, 429, "api bucket should be exhausted");

	const health = await proxy(
		new NextRequest("http://localhost:3005/api/health", {
			headers: { "x-forwarded-for": ip },
		}),
	);
	assert.notEqual(
		health.status,
		429,
		"an exhausted api bucket must not take the healthcheck down with it",
	);
});

test("omits rate limit headers on exempt routes", async () => {
	const response = await proxy(
		new NextRequest("http://localhost:3005/api/health", {
			headers: { "x-forwarded-for": "198.51.100.32" },
		}),
	);

	assert.equal(response.headers.get("X-RateLimit-Limit"), null);
	assert.equal(response.headers.get("X-RateLimit-Remaining"), null);
});

test("uses in-memory limiting when REDIS_URL is unset", async () => {
	delete process.env.REDIS_URL;
	const limiter = await getRateLimiter();
	assert.equal(limiter.constructor.name, "MemoryRateLimiter");
});

test("uses the Redis limiter when REDIS_URL is set", async () => {
	process.env.REDIS_URL = "redis://localhost:6379";
	// The limiter memoises on first use, so reach the memoised instance through
	// the same path the proxy does rather than asserting on a fresh one.
	const limiter = await getRateLimiter();
	assert.equal(limiter.constructor.name, "RedisRateLimiter");
});

test("Redis limiter fails CLOSED when Redis errors mid-request", async () => {
	process.env.REDIS_URL = "redis://localhost:6379";
	redisEvalImpl = async () => {
		throw new Error("connection lost");
	};

	const limiter = await getRateLimiter();
	const result = await limiter.checkLimit("203.0.113.1:/api/x", 100, 60000);

	assert.equal(
		result.limited,
		true,
		"a limiter that allows traffic through the moment Redis is unreachable is no limiter during a flood",
	);
	assert.equal(result.remaining, 0);
});
