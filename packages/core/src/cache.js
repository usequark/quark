/**
 * Cache utility for Redis-based caching with TTL and invalidation.
 * Designed to be used with any Redis client (ioredis, redis, etc.)
 *
 * @example
 * ```js
 * import Redis from "ioredis";
 * import { createCache } from "@quark/core";
 *
 * const redis = new Redis();
 * const cache = createCache(redis, { prefix: "app:", defaultTTL: 600 });
 *
 * await cache.set("user:1", { name: "Alice" });
 * const user = await cache.get("user:1");
 * ```
 */

/**
 * Creates a cache instance backed by a Redis client.
 *
 * @param {import("ioredis").Redis} redisClient — any Redis client with get/set/del/keys/expire methods
 * @param {Object} [options]
 * @param {string} [options.prefix="cache:"] — key prefix for namespacing
 * @param {number} [options.defaultTTL=300] — default TTL in seconds (5 minutes)
 * @returns {ReturnType<typeof createCache>}
 */
export function createCache(redisClient, options = {}) {
	const { prefix = "cache:", defaultTTL = 300 } = options;

	return {
		/**
		 * Get a cached value.
		 *
		 * @param {string} key
		 * @returns {Promise<any|null>} Parsed value or null if not found
		 */
		async get(key) {
			const raw = await redisClient.get(`${prefix}${key}`);
			if (raw === null || raw === undefined) return null;
			try {
				return JSON.parse(raw);
			} catch {
				return null;
			}
		},

		/**
		 * Set a cached value with optional TTL (atomic SET + EX).
		 *
		 * @param {string} key
		 * @param {any} value — will be JSON.stringified
		 * @param {number} [ttl] — TTL in seconds, defaults to defaultTTL
		 */
		async set(key, value, ttl) {
			const prefixedKey = `${prefix}${key}`;
			const serialized = JSON.stringify(value);
			await redisClient.set(prefixedKey, serialized, "EX", ttl ?? defaultTTL);
		},

		/**
		 * Delete a cached key.
		 *
		 * @param {string} key
		 */
		async del(key) {
			await redisClient.del(`${prefix}${key}`);
		},

		/**
		 * Delete all keys matching a pattern using SCAN (non-blocking, production-safe).
		 *
		 * @param {string} pattern — e.g., "user:*"
		 */
		async invalidate(pattern) {
			const matchPattern = `${prefix}${pattern}`;
			let cursor = "0";
			do {
				const [nextCursor, keys] = await redisClient.scan(
					cursor,
					"MATCH",
					matchPattern,
					"COUNT",
					100,
				);
				cursor = nextCursor;
				if (keys.length > 0) {
					await Promise.all(keys.map((k) => redisClient.del(k)));
				}
			} while (cursor !== "0");
		},

		/**
		 * Get-or-set pattern: returns cached value if it exists,
		 * otherwise calls factory, caches the result, and returns it.
		 *
		 * @param {string} key
		 * @param {Function} factory — async function that produces the value
		 * @param {number} [ttl] — TTL in seconds, defaults to defaultTTL
		 * @returns {Promise<any>}
		 */
		async getOrSet(key, factory, ttl) {
			const cached = await this.get(key);
			if (cached !== null) return cached;

			const value = await factory();
			await this.set(key, value, ttl);
			return value;
		},

		/**
		 * Wrap a function with caching. Returns a new function that
		 * caches results based on argument serialisation.
		 *
		 * @param {Function} fn — the function to wrap
		 * @param {Object} [wrapOptions]
		 * @param {string} [wrapOptions.keyPrefix] — prefix for generated cache keys
		 * @param {number} [wrapOptions.ttl] — TTL in seconds
		 * @param {Function} [wrapOptions.keyGenerator] — custom key generator `(...args) => string`
		 * @returns {Function}
		 */
		wrap(fn, wrapOptions = {}) {
			const {
				keyPrefix = fn.name || "wrapped",
				ttl,
				keyGenerator,
			} = wrapOptions;

			return async (...args) => {
				const cacheKey = keyGenerator
					? `${keyPrefix}:${keyGenerator(...args)}`
					: `${keyPrefix}:${JSON.stringify(args)}`;

				return this.getOrSet(cacheKey, () => fn(...args), ttl);
			};
		},
	};
}
