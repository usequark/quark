import { resolveRedisConnection } from "@usequark/quark-core/redis";

let _redis = null;

/**
 * Get a shared Redis client. Creates and connects on first call, reuses thereafter.
 * Returns null if Redis is unavailable (fail-open).
 *
 * @returns {Promise<import("ioredis").default | null>}
 */
export async function getSharedRedisClient() {
	if (_redis) return _redis;
	try {
		const conn = resolveRedisConnection();
		const { default: Redis } = await import("ioredis");
		_redis = new Redis({
			...conn,
			lazyConnect: true,
			maxRetriesPerRequest: 0,
			enableReadyCheck: false,
		});
		_redis.on("error", () => {}); // Suppress errors
		await _redis.connect();
		return _redis;
	} catch {
		await closeSharedRedisClient();
		return null;
	}
}

/**
 * Close the shared Redis client (for graceful shutdown).
 */
export async function closeSharedRedisClient() {
	if (_redis) {
		try {
			await _redis.disconnect();
		} catch {
			// ignore disconnect errors
		}
		_redis = null;
	}
}
