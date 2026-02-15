import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createCache } from "./cache.js";

/**
 * Creates a mock Redis client backed by a Map.
 * Provides get, set, del, keys, and expire methods.
 */
function createMockRedis() {
	const store = new Map();
	const expires = new Map();

	return {
		store,
		expires,

		async get(key) {
			return store.has(key) ? store.get(key) : null;
		},

		async set(key, value, ...args) {
			store.set(key, value);
			// Support atomic SET key value EX seconds
			if (args[0] === "EX" && args[1] != null) {
				expires.set(key, args[1]);
			}
		},

		async del(key) {
			store.delete(key);
			expires.delete(key);
		},

		async scan(_cursor, ...args) {
			// Simple mock: return all matching keys in one batch
			const matchIdx = args.indexOf("MATCH");
			const pattern = matchIdx !== -1 ? args[matchIdx + 1] : "*";
			const regex = new RegExp(
				`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*")}$`,
			);
			const keys = [...store.keys()].filter((k) => regex.test(k));
			return ["0", keys];
		},

		async expire(key, seconds) {
			expires.set(key, seconds);
		},
	};
}

describe("createCache", () => {
	let redis;
	let cache;

	beforeEach(() => {
		redis = createMockRedis();
		cache = createCache(redis, { prefix: "test:", defaultTTL: 60 });
	});

	describe("get", () => {
		it("returns null for a missing key", async () => {
			const result = await cache.get("nonexistent");
			assert.equal(result, null);
		});

		it("returns parsed JSON for an existing key", async () => {
			redis.store.set("test:hello", JSON.stringify({ a: 1 }));
			const result = await cache.get("hello");
			assert.deepEqual(result, { a: 1 });
		});

		it("returns null for invalid JSON", async () => {
			redis.store.set("test:bad", "not-json{");
			const result = await cache.get("bad");
			assert.equal(result, null);
		});
	});

	describe("set", () => {
		it("round-trips JSON values through set/get", async () => {
			const data = { users: [1, 2, 3], active: true };
			await cache.set("data", data);
			const result = await cache.get("data");
			assert.deepEqual(result, data);
		});

		it("passes TTL to Redis expire", async () => {
			await cache.set("key", "value", 120);
			assert.equal(redis.expires.get("test:key"), 120);
		});

		it("uses defaultTTL when no TTL is provided", async () => {
			await cache.set("key", "value");
			assert.equal(redis.expires.get("test:key"), 60);
		});
	});

	describe("del", () => {
		it("removes a key", async () => {
			await cache.set("gone", "bye");
			await cache.del("gone");
			const result = await cache.get("gone");
			assert.equal(result, null);
		});
	});

	describe("invalidate", () => {
		it("deletes all keys matching a pattern", async () => {
			await cache.set("user:1", "alice");
			await cache.set("user:2", "bob");
			await cache.set("post:1", "hello");

			await cache.invalidate("user:*");

			assert.equal(await cache.get("user:1"), null);
			assert.equal(await cache.get("user:2"), null);
			assert.notEqual(await cache.get("post:1"), null);
		});

		it("does nothing when no keys match", async () => {
			await cache.set("a", 1);
			await cache.invalidate("zzz:*");
			assert.deepEqual(await cache.get("a"), 1);
		});
	});

	describe("getOrSet", () => {
		it("calls factory on cache miss and caches the result", async () => {
			let called = 0;
			const factory = async () => {
				called++;
				return { fresh: true };
			};

			const result = await cache.getOrSet("miss", factory);
			assert.deepEqual(result, { fresh: true });
			assert.equal(called, 1);

			// Value should now be cached
			const cached = await cache.get("miss");
			assert.deepEqual(cached, { fresh: true });
		});

		it("returns cached value without calling factory on hit", async () => {
			await cache.set("hit", { cached: true });

			let called = 0;
			const factory = async () => {
				called++;
				return { fresh: true };
			};

			const result = await cache.getOrSet("hit", factory);
			assert.deepEqual(result, { cached: true });
			assert.equal(called, 0);
		});
	});

	describe("wrap", () => {
		it("creates a cached function", async () => {
			let calls = 0;
			const expensive = async (x) => {
				calls++;
				return x * 2;
			};

			const cachedFn = cache.wrap(expensive, { keyPrefix: "double" });

			const first = await cachedFn(5);
			assert.equal(first, 10);
			assert.equal(calls, 1);

			const second = await cachedFn(5);
			assert.equal(second, 10);
			assert.equal(calls, 1); // Cache hit — factory not called again
		});

		it("uses keyGenerator when provided", async () => {
			let _calls = 0;
			const fn = async (a, b) => {
				_calls++;
				return a + b;
			};

			const cachedFn = cache.wrap(fn, {
				keyPrefix: "sum",
				keyGenerator: (a, b) => `${a}+${b}`,
			});

			const result = await cachedFn(2, 3);
			assert.equal(result, 5);

			// Verify the custom key was used
			const storedKey = "test:sum:2+3";
			assert.ok(redis.store.has(storedKey));
		});

		it("caches different args separately", async () => {
			let calls = 0;
			const fn = async (x) => {
				calls++;
				return x * 3;
			};

			const cachedFn = cache.wrap(fn, { keyPrefix: "triple" });

			assert.equal(await cachedFn(1), 3);
			assert.equal(await cachedFn(2), 6);
			assert.equal(calls, 2);

			// Both should now be cached
			assert.equal(await cachedFn(1), 3);
			assert.equal(await cachedFn(2), 6);
			assert.equal(calls, 2);
		});
	});
});
