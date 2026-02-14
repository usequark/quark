import assert from "node:assert";
import { test } from "node:test";
import {
	createRateLimiter,
	createRateLimitMiddleware,
	RATE_LIMIT_PRESETS,
} from "../src/rate-limiter.js";

test("Rate Limiter Module", async (t) => {
	await t.test("createRateLimiter creates memory limiter by default", () => {
		const limiter = createRateLimiter();
		assert(limiter !== null);
	});

	await t.test(
		"createRateLimiter throws error for Redis without client",
		() => {
			assert.throws(
				() => createRateLimiter({ type: "redis" }),
				/Redis client is required/,
			);
		},
	);

	await t.test("Memory rate limiter allows requests under limit", async () => {
		const limiter = createRateLimiter({ type: "memory" });
		const result = await limiter.checkLimit("test-key", 5, 60000);

		assert.strictEqual(result.limited, false);
		assert.strictEqual(result.remaining, 4);
		assert(result.resetTime > Date.now());
	});

	await t.test("Memory rate limiter blocks requests over limit", async () => {
		const limiter = createRateLimiter({ type: "memory" });

		// Make 5 requests (limit is 5)
		for (let i = 0; i < 5; i++) {
			await limiter.checkLimit("test-key-2", 5, 60000);
		}

		// 6th request should be blocked
		const result = await limiter.checkLimit("test-key-2", 5, 60000);
		assert.strictEqual(result.limited, true);
		assert.strictEqual(result.remaining, 0);
	});

	await t.test("Memory rate limiter resets after window", async () => {
		const limiter = createRateLimiter({ type: "memory" });

		// Make a request with very short window
		const result1 = await limiter.checkLimit("test-key-3", 1, 10);
		assert.strictEqual(result1.limited, false);

		// Second request should be blocked
		const result2 = await limiter.checkLimit("test-key-3", 1, 10);
		assert.strictEqual(result2.limited, true);

		// Wait for window to expire
		await new Promise((resolve) => setTimeout(resolve, 20));

		// Should be allowed again
		const result3 = await limiter.checkLimit("test-key-3", 1, 10);
		assert.strictEqual(result3.limited, false);
	});

	await t.test("Memory rate limiter can reset a key", async () => {
		const limiter = createRateLimiter({ type: "memory" });

		await limiter.checkLimit("test-key-4", 1, 60000);
		await limiter.reset("test-key-4");

		const result = await limiter.checkLimit("test-key-4", 1, 60000);
		assert.strictEqual(result.limited, false);
	});

	await t.test("Memory rate limiter can clear all keys", async () => {
		const limiter = createRateLimiter({ type: "memory" });

		await limiter.checkLimit("key-1", 1, 60000);
		await limiter.checkLimit("key-2", 1, 60000);
		await limiter.clear();

		const result1 = await limiter.checkLimit("key-1", 1, 60000);
		const result2 = await limiter.checkLimit("key-2", 1, 60000);

		assert.strictEqual(result1.limited, false);
		assert.strictEqual(result2.limited, false);
	});

	await t.test("RATE_LIMIT_PRESETS have correct structure", () => {
		assert(RATE_LIMIT_PRESETS.strict);
		assert(RATE_LIMIT_PRESETS.moderate);
		assert(RATE_LIMIT_PRESETS.relaxed);
		assert(RATE_LIMIT_PRESETS.auth);
		assert(RATE_LIMIT_PRESETS.api);

		assert.strictEqual(RATE_LIMIT_PRESETS.auth.maxRequests, 5);
		assert.strictEqual(RATE_LIMIT_PRESETS.api.maxRequests, 100);
	});

	await t.test("createRateLimitMiddleware returns a function", () => {
		const limiter = createRateLimiter({ type: "memory" });
		const middleware = createRateLimitMiddleware(limiter);

		assert.strictEqual(typeof middleware, "function");
	});

	await t.test("createRateLimitMiddleware works with API preset", async () => {
		const limiter = createRateLimiter({ type: "memory" });
		const middleware = createRateLimitMiddleware(
			limiter,
			RATE_LIMIT_PRESETS.api,
		);

		const result = await middleware("192.168.1.1", "/api/posts");

		assert.strictEqual(result.limited, false);
		assert(result.remaining > 0);
	});

	await t.test("Cleanup interval is started for memory limiter", () => {
		const limiter = createRateLimiter({ type: "memory" });
		assert(limiter.cleanupInterval !== null);

		// Clean up
		limiter.stopCleanup();
		assert(limiter.cleanupInterval === null);
	});
});
