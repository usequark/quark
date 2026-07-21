/**
 * Sliding window rate limiter using Redis sorted sets.
 * Provides distributed rate limiting across server instances.
 * Falls back gracefully if Redis is unavailable (fail-open).
 */

import { getSharedRedisClient } from "./redis.js";

/**
 * Sliding window rate limiter using Redis sorted sets.
 * Each request is scored by its timestamp, and expired entries are pruned on each call.
 * TTL on the key ensures automatic cleanup of old data.
 *
 * @param {string} key - Unique key for the rate limit (e.g., `chat:userId`)
 * @param {number} limit - Max requests per window
 * @param {number} windowMs - Window size in milliseconds (default: 60000 = 1 min)
 * @returns {Promise<{ allowed: boolean, remaining: number, reset: number }>}
 */
export async function rateLimit(key, limit = 10, windowMs = 60000) {
	const now = Date.now();
	const windowStart = now - windowMs;

	try {
		const client = await getSharedRedisClient();
		if (!client) {
			// Fail open - Redis unavailable
			return {
				allowed: true,
				remaining: limit,
				reset: Math.ceil((now + windowMs) / 1000),
			};
		}

		const redisKey = `ratelimit:${key}`;

		// Pipeline: remove expired entries, count, optionally add request
		// We use a Lua script for atomicity
		const luaScript = `
			local key = KEYS[1]
			local window_start = tonumber(ARGV[1])
			local now = tonumber(ARGV[2])
			local limit = tonumber(ARGV[3])
			local window_ms = tonumber(ARGV[4])
			local window_end = now + window_ms

			-- Remove entries outside the window
			redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

			-- Count remaining entries in window
			local count = redis.call('ZCARD', key)

			if count >= limit then
				-- Rate limited - return oldest entry for reset calculation
				local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
				local reset_time = window_end
				if #oldest >= 2 then
					reset_time = tonumber(oldest[2]) + window_ms
				end
				return {0, 0, reset_time}
			end

			-- Add current request (score = timestamp, member = unique)
			local member = now .. ':' .. math.random(1000000)
			redis.call('ZADD', key, now, member)

			-- Set TTL on the key for automatic cleanup
			redis.call('PEXPIRE', key, window_ms + 1000)

			local remaining = limit - count - 1
			local reset_time = window_end

			return {1, remaining, reset_time}
		`;

		const [allowed, remaining, reset] = await client.eval(
			luaScript,
			1,
			redisKey,
			windowStart,
			now,
			limit,
			windowMs,
		);

		return {
			allowed: allowed === 1,
			remaining,
			reset: Math.ceil(reset / 1000),
		};
	} catch {
		// Fail open - Redis error
		return {
			allowed: true,
			remaining: limit,
			reset: Math.ceil((now + windowMs) / 1000),
		};
	}
}

/**
 * Apply rate limiting to a Next.js API route request.
 * Returns a 429 Response if rate limited, or null if the request is allowed.
 * Includes rate limit headers in the returned response.
 *
 * @param {string} identifier - Unique identifier (userId or IP)
 * @param {object} options - { limit, windowMs, route }
 * @returns {Promise<Response | null>}
 */
export async function applyRateLimit(identifier, options = {}) {
	const { limit = 10, windowMs = 60000, route = "default" } = options;
	const key = `${route}:${identifier}`;

	const result = await rateLimit(key, limit, windowMs);

	if (!result.allowed) {
		const retryAfter = Math.max(0, result.reset - Math.ceil(Date.now() / 1000));
		return new Response(
			JSON.stringify({
				error: "Rate limit exceeded. Please try again later.",
				retryAfter,
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"X-RateLimit-Limit": String(limit),
					"X-RateLimit-Remaining": "0",
					"X-RateLimit-Reset": String(result.reset),
					"Retry-After": String(retryAfter),
				},
			},
		);
	}

	return null;
}
