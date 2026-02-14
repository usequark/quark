/**
 * @bobnoddle/quark-core - Rate Limiting Module
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
 */
class RedisRateLimiter {
	constructor(redisClient) {
		this.redis = redisClient;
	}

	/**
	 * Check and increment rate limit using Redis
	 */
	async checkLimit(key, maxRequests, windowMs) {
		const now = Date.now();
		const windowKey = `ratelimit:${key}`;

		try {
			// Use Redis pipeline for atomic operations
			const pipeline = this.redis.pipeline();

			// Get current count and TTL
			pipeline.get(windowKey);
			pipeline.pttl(windowKey);

			const [[, count], [, ttl]] = await pipeline.exec();

			const currentCount = count ? parseInt(count, 10) : 0;
			const resetTime = ttl > 0 ? now + ttl : now + windowMs;

			// Check if limit exceeded
			if (currentCount >= maxRequests) {
				return {
					limited: true,
					remaining: 0,
					resetTime,
				};
			}

			// Increment counter
			const incrPipeline = this.redis.pipeline();
			incrPipeline.incr(windowKey);

			// Set expiry only if this is the first request in the window
			if (currentCount === 0) {
				incrPipeline.pexpire(windowKey, windowMs);
			}

			await incrPipeline.exec();

			return {
				limited: false,
				remaining: maxRequests - currentCount - 1,
				resetTime,
			};
		} catch (error) {
			console.error("Redis rate limiter error:", error);
			// Fail open - allow request if Redis is down
			// In production, you might want to fail closed (deny request)
			return {
				limited: false,
				remaining: maxRequests,
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
	 * Clear all rate limit keys (use with caution)
	 */
	async clear() {
		const keys = await this.redis.keys("ratelimit:*");
		if (keys.length > 0) {
			await this.redis.del(...keys);
		}
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
		return new RedisRateLimiter(redisClient);
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
