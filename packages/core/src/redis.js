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
 * Creates a Redis configuration object from environment variables.
 * Returns the URL and any additional options — does not create an actual connection.
 * Pass the URL to your Redis library of choice (e.g., ioredis).
 */
export const createRedisConfig = (options = {}) => {
	const redisUrl = getRedisUrl();

	return {
		url: redisUrl,
		...options,
	};
};

/**
 * @deprecated Use `createRedisConfig` instead.
 */
export const createRedisClient = createRedisConfig;

export { getRedisUrl };
