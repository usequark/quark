/**
 * Builds REDIS_URL from individual environment variables if not explicitly provided.
 * Allows configuration via individual REDIS_* vars instead of a single REDIS_URL.
 */
function getRedisUrl() {
	if (process.env.REDIS_URL) {
		return process.env.REDIS_URL;
	}

	const host = process.env.REDIS_HOST || "localhost";
	const port = process.env.REDIS_PORT || "6379";

	return `redis://${host}:${port}`;
}

/**
 * Creates a Redis client instance.
 * Can be extended to create singleton or connection pooling if needed.
 */
export const createRedisClient = (options = {}) => {
	const redisUrl = getRedisUrl();

	// Return the URL for now - implement actual client when redis package is added
	// This allows consumers to pass it to their Redis library of choice
	return {
		url: redisUrl,
		...options,
	};
};

export { getRedisUrl };
