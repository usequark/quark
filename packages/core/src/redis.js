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

/**
 * Pings Redis to verify connectivity.
 * Dynamically imports ioredis so it doesn't fail at load time if the package is not installed.
 * Creates a temporary connection, sends PING, expects PONG, then disconnects.
 *
 * @param {object} [options]
 * @param {number} [options.timeout=3000] - Connection/ping timeout in milliseconds.
 * @returns {Promise<{ status: "ok", latencyMs: number } | { status: "error", message: string }>}
 */
export async function pingRedis({ timeout = 3000 } = {}) {
	/** @type {import("ioredis").default | null} */
	let client = null;

	try {
		const { default: Redis } = await import("ioredis");

		const url = getRedisUrl();

		client = new Redis(url, {
			lazyConnect: true,
			connectTimeout: timeout,
			maxRetriesPerRequest: 0,
			enableReadyCheck: false,
		});

		await client.connect();

		const start = performance.now();
		const result = await Promise.race([
			client.ping(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("PING timed out")), timeout),
			),
		]);

		const latencyMs = Math.round(performance.now() - start);

		if (result !== "PONG") {
			return {
				status: "error",
				message: `Unexpected PING response: ${result}`,
			};
		}

		return { status: "ok", latencyMs };
	} catch (/** @type {any} */ error) {
		const message =
			error?.code === "MODULE_NOT_FOUND" ||
			error?.code === "ERR_MODULE_NOT_FOUND"
				? "ioredis is not installed"
				: (error?.message ?? String(error));
		return { status: "error", message };
	} finally {
		try {
			await client?.disconnect();
		} catch {
			// ignore disconnect errors
		}
	}
}

export { getRedisUrl };
