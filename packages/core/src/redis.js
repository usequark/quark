import { redactUrl } from "./utils.js";

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
 * Returns the URL and any additional options - does not create an actual connection.
 * Pass the URL to your Redis library of choice (e.g., ioredis).
 *
 * @deprecated Use `resolveRedisConnection` for ioredis/BullMQ configs, or `getRedisUrl` for URL strings.
 */
export const createRedisConfig = (options = {}) => {
	const redisUrl = getRedisUrl();

	return {
		url: redisUrl,
		...options,
	};
};

/**
 * @deprecated Use `resolveRedisConnection` instead.
 */
export const createRedisClient = createRedisConfig;

/**
 * Pings Redis to verify connectivity.
 * Dynamically imports ioredis so it doesn't fail at load time if the package is not installed.
 * Creates a temporary connection, sends PING, expects PONG, then disconnects.
 *
 * The `message` on the error path is safe to return from an unauthenticated
 * endpoint: it never contains a password (see `getRedisEndpoint`).
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

		const conn = resolveRedisConnection();

		client = new Redis({
			...conn,
			lazyConnect: true,
			connectTimeout: timeout,
			maxRetriesPerRequest: 0,
			enableReadyCheck: false,
		});

		// Suppress the "Unhandled error event" stderr noise that ioredis emits
		// when a connection attempt fails. The error is still caught by the
		// try/catch below - this listener just prevents Node from treating it
		// as an unhandled EventEmitter error.
		client.on("error", () => {});

		await client.connect();

		const start = performance.now();
		const result = await new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error("PING timed out")),
				timeout,
			);
			client.ping().then(
				(val) => {
					clearTimeout(timer);
					resolve(val);
				},
				(err) => {
					clearTimeout(timer);
					reject(err);
				},
			);
		});

		const latencyMs = Math.round(performance.now() - start);

		if (result !== "PONG") {
			return {
				status: "error",
				message: `Unexpected PING response: ${result}`,
			};
		}

		return { status: "ok", latencyMs };
	} catch (/** @type {any} */ error) {
		let message;
		if (
			error?.code === "MODULE_NOT_FOUND" ||
			error?.code === "ERR_MODULE_NOT_FOUND"
		) {
			message = "ioredis is not installed";
		} else if (
			error?.code === "ECONNREFUSED" ||
			/connection is closed|ECONNREFUSED/i.test(error?.message ?? "")
		) {
			message = `Redis unreachable at ${getRedisEndpoint()}`;
		} else {
			message = error?.message ?? String(error);
		}
		return { status: "error", message };
	} finally {
		try {
			await client?.disconnect();
		} catch {
			// ignore disconnect errors
		}
	}
}

/**
 * Returns the Redis endpoint as `host:port`, with every credential removed.
 *
 * The message from `pingRedis` is returned verbatim by the unauthenticated
 * `/api/health` route, so it must never carry a password. `getRedisUrl()` is
 * deliberately not used for this: callers need the working connection string,
 * and it embeds `REDIS_URL` credentials as-is.
 *
 * @returns {string} e.g. `redis.railway.internal:6379`
 */
export function getRedisEndpoint() {
	const url = getRedisUrl();

	try {
		const parsed = new URL(url);
		const port =
			parsed.port || (parsed.protocol === "rediss:" ? "6380" : "6379");
		return `${parsed.hostname}:${port}`;
	} catch {
		// Malformed REDIS_URL — fall back to whatever credentials-safe form the
		// redaction pass can produce rather than echoing the raw value.
		return redactUrl(url);
	}
}

/**
 * Resolves Redis connection config as an ioredis-compatible options object.
 * Precedence: explicit override > REDIS_URL > REDIS_HOST/REDIS_PORT > localhost defaults.
 *
 * @param {object} [override] - if provided, returned as-is (pass-through for caller-supplied config)
 * @returns {{ host: string, port: number, password?: string, tls?: object }}
 */
export function resolveRedisConnection(override) {
	if (override) return override;

	if (process.env.REDIS_URL) {
		try {
			const u = new URL(process.env.REDIS_URL);
			return {
				host: u.hostname,
				port: parseInt(u.port || "6379", 10),
				...(u.password && { password: decodeURIComponent(u.password) }),
				...(u.protocol === "rediss:" && { tls: {} }),
			};
		} catch {
			// Malformed REDIS_URL - fall through to host/port env vars
		}
	}

	return {
		host: process.env.REDIS_HOST || "localhost",
		port: parseInt(process.env.REDIS_PORT || "6379", 10),
	};
}

export { getRedisUrl };
