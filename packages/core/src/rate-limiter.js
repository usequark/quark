/**
 * @techstream/quark-core - Rate Limiting Module
 * Provides both in-memory and Redis-based rate limiting
 */

/**
 * In-memory rate limiter (for single-instance deployments)
 */
class MemoryRateLimiter {
	constructor() {
		this.store = new Map();
		this.cleanupInterval = null;
	}

	/**
	 * Start periodic cleanup of expired records
	 */
	startCleanup(intervalMs = 60000) {
		if (this.cleanupInterval) return;

		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			for (const [key, record] of this.store.entries()) {
				if (now > record.resetTime) {
					this.store.delete(key);
				}
			}
		}, intervalMs);

		// Don't keep the process alive just for cleanup
		this.cleanupInterval.unref();
	}

	/**
	 * Stop cleanup interval
	 */
	stopCleanup() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}

	/**
	 * Check and increment rate limit
	 */
	async checkLimit(key, maxRequests, windowMs) {
		const now = Date.now();
		const record = this.store.get(key) || {
			count: 0,
			resetTime: now + windowMs,
		};

		// Reset if window has passed
		if (now > record.resetTime) {
			record.count = 0;
			record.resetTime = now + windowMs;
		}

		// Check if limit exceeded
		if (record.count >= maxRequests) {
			return {
				limited: true,
				remaining: 0,
				resetTime: record.resetTime,
			};
		}

		// Increment counter
		record.count++;
		this.store.set(key, record);

		return {
			limited: false,
			remaining: maxRequests - record.count,
			resetTime: record.resetTime,
		};
	}

	/**
	 * Reset a specific key
	 */
	async reset(key) {
		this.store.delete(key);
	}

	/**
	 * Clear all records
	 */
	async clear() {
		this.store.clear();
	}
}

/**
 * Redis-based rate limiter (for multi-instance deployments)
 * Uses Lua scripting for atomic check-and-increment.
 */
class RedisRateLimiter {
	constructor(redisClient, options = {}) {
		this.redis = redisClient;
		this.failOpen = options.failOpen ?? true;
	}

	/**
	 * Check and increment rate limit using an atomic Lua script.
	 * Prevents TOCTOU race conditions by doing INCR + PEXPIRE in one round-trip.
	 */
	async checkLimit(key, maxRequests, windowMs) {
		const now = Date.now();
		const windowKey = `ratelimit:${key}`;

		try {
			// Atomic Lua: INCR the key, set PEXPIRE on first request, return [count, pttl]
			const luaScript = `
				local count = redis.call('INCR', KEYS[1])
				if count == 1 then
					redis.call('PEXPIRE', KEYS[1], ARGV[1])
				end
				local ttl = redis.call('PTTL', KEYS[1])
				return {count, ttl}
			`;

			const [currentCount, ttl] = await this.redis.eval(
				luaScript,
				1,
				windowKey,
				windowMs,
			);

			const resetTime = ttl > 0 ? now + ttl : now + windowMs;

			if (currentCount > maxRequests) {
				return {
					limited: true,
					remaining: 0,
					resetTime,
				};
			}

			return {
				limited: false,
				remaining: maxRequests - currentCount,
				resetTime,
			};
		} catch (_error) {
			// Configurable fail-open / fail-closed behaviour
			if (this.failOpen) {
				return {
					limited: false,
					remaining: maxRequests,
					resetTime: now + windowMs,
				};
			}
			return {
				limited: true,
				remaining: 0,
				resetTime: now + windowMs,
			};
		}
	}

	/**
	 * Reset a specific key
	 */
	async reset(key) {
		await this.redis.del(`ratelimit:${key}`);
	}

	/**
	 * Clear all rate limit keys using SCAN (non-blocking, production-safe)
	 */
	async clear() {
		let cursor = "0";
		do {
			const [nextCursor, keys] = await this.redis.scan(
				cursor,
				"MATCH",
				"ratelimit:*",
				"COUNT",
				100,
			);
			cursor = nextCursor;
			if (keys.length > 0) {
				await this.redis.del(...keys);
			}
		} while (cursor !== "0");
	}
}

/**
 * Create a rate limiter instance
 * @param {Object} options - Configuration options
 * @param {string} options.type - "memory" or "redis"
 * @param {Object} options.redisClient - Redis client instance (required if type is "redis")
 * @returns {MemoryRateLimiter|RedisRateLimiter}
 */
export function createRateLimiter(options = {}) {
	const { type = "memory", redisClient = null } = options;

	if (type === "redis") {
		if (!redisClient) {
			throw new Error("Redis client is required for Redis-based rate limiting");
		}
		return new RedisRateLimiter(redisClient, { failOpen: options.failOpen });
	}

	const limiter = new MemoryRateLimiter();
	limiter.startCleanup();
	return limiter;
}

/**
 * Rate limiter configuration
 */
export const RATE_LIMIT_PRESETS = {
	strict: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 5,
	},
	moderate: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 50,
	},
	relaxed: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 100,
	},
	auth: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 5,
	},
	api: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 100,
	},
};

/**
 * Helper function to create rate limit middleware
 * @param {Object} limiter - Rate limiter instance
 * @param {Object} config - Rate limit configuration
 * @returns {Function} Middleware function
 */
export function createRateLimitMiddleware(
	limiter,
	config = RATE_LIMIT_PRESETS.api,
) {
	return async (ip, path) => {
		const key = `${ip}:${path}`;
		return limiter.checkLimit(key, config.maxRequests, config.windowMs);
	};
}
