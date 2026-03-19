/**
 * @techstream/quark-core - Job Queue Module
 * Provides BullMQ queue initialization and management
 */

import { Queue, QueueEvents, Worker } from "bullmq";
import { ServiceError } from "../errors.js";
import { createLogger } from "../logger.js";
import { resolveRedisConnection } from "../redis.js";

const logger = createLogger("queue");

/**
 * Returns the default Redis config for BullMQ connections.
 * Evaluated lazily so env vars set after module load (e.g. via dotenv) are respected.
 * Uses resolveRedisConnection() — supports REDIS_URL, REDIS_HOST/REDIS_PORT, and localhost fallback.
 */
function getDefaultRedisConfig() {
	return {
		...resolveRedisConnection(),
		db: parseInt(process.env.REDIS_DB || "0", 10),
		retryStrategy: (times) => {
			const delay = Math.min(times * 50, 2000);
			return delay;
		},
	};
}

/**
 * Redis config for health checks only.
 * Disables the offline queue so commands fail immediately if not connected,
 * and sets a short connect timeout so we don't hang indefinitely.
 */
function getHealthCheckRedisConfig() {
	return {
		...getDefaultRedisConfig(),
		enableOfflineQueue: false,
		connectTimeout: 3000,
		maxRetriesPerRequest: 0,
		retryStrategy: () => null, // don't auto-retry — let waitForRedis control the loop
	};
}

/**
 * Map to store singleton queue instances
 */
const queues = new Map();
const queueConnections = new Map();

const getRedisAddress = (redisConfig) => {
	const cfg = redisConfig || getDefaultRedisConfig();
	if (cfg.url) {
		try {
			const url = new URL(cfg.url);
			return `${url.hostname}:${url.port || "6379"}`;
		} catch {
			return cfg.url;
		}
	}
	return `${cfg.host}:${cfg.port}`;
};

/**
 * Creates or retrieves a singleton BullMQ queue
 * @param {string} name - Queue name
 * @param {Object} options - Queue options
 * @param {Object} options.redis - Redis connection config
 * @param {Object} options.defaultJobOptions - Default job options
 * @returns {Queue} BullMQ Queue instance
 */
export const createQueue = (name, options = {}) => {
	if (queues.has(name)) {
		return queues.get(name);
	}

	const {
		redis = getDefaultRedisConfig(),
		defaultJobOptions = {
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
			removeOnComplete: true,
		},
		...queueOptions
	} = options;

	const queue = new Queue(name, {
		connection: redis,
		defaultJobOptions,
		...queueOptions,
	});

	queues.set(name, queue);
	queueConnections.set(name, redis);

	// Clean up on graceful shutdown
	queue.on("error", (error) => {
		logger.error(`Queue "${name}" encountered an error`, {
			error: error.message,
			code: error.code,
		});
	});

	return queue;
};

/**
 * Creates a job processor worker
 * @param {string} queueName - Queue name
 * @param {Function} handler - Job handler function(job) => Promise<any>
 * @param {Object} options - Worker options
 * @param {Object} options.redis - Redis connection config
 * @param {number} options.concurrency - Concurrency level
 * @returns {Worker} BullMQ Worker instance
 */
export const createWorker = (queueName, handler, options = {}) => {
	const {
		redis = getDefaultRedisConfig(),
		concurrency = 1,
		...workerOptions
	} = options;

	const worker = new Worker(queueName, handler, {
		connection: redis,
		concurrency,
		...workerOptions,
	});

	worker.on("error", (error) => {
		logger.error(`Worker for queue "${queueName}" encountered an error`, {
			error: error.message,
			code: error.code,
		});
	});

	worker.on("failed", (job, error) => {
		logger.error(`Job ${job?.id} in queue "${queueName}" failed`, {
			jobId: job?.id,
			queue: queueName,
			error: error.message,
			attempts: job?.attemptsMade,
		});
	});

	return worker;
};

/**
 * Gets or creates queue events listener
 * @param {string} queueName - Queue name
 * @param {Object} options - QueueEvents options
 * @returns {QueueEvents} BullMQ QueueEvents instance
 */
export const createQueueEvents = (queueName, options = {}) => {
	const { redis = getDefaultRedisConfig(), ...eventsOptions } = options;

	return new QueueEvents(queueName, {
		connection: redis,
		...eventsOptions,
	});
};

/**
 * Utility to add a job to a queue with error handling
 * @param {Queue} queue - BullMQ Queue instance
 * @param {string} jobName - Job name/type (e.g., 'send-welcome-email')
 * @param {Object} data - Job data
 * @param {Object} jobOptions - Job-specific options
 * @returns {Promise<Job>} Queued job
 */
export const addJob = async (queue, jobName, data, jobOptions = {}) => {
	try {
		const job = await queue.add(jobName, data, jobOptions);
		return job;
	} catch (error) {
		throw new ServiceError(
			"BullMQ",
			`Failed to add job "${jobName}" to queue "${queue.name}": ${error.message}`,
			500,
		);
	}
};

/**
 * Utility to get job status and progress
 * @param {Job} job - BullMQ Job instance
 * @returns {Promise<Object>} Job status information
 */
export const getJobStatus = async (job) => {
	return {
		id: job.id,
		state: await job.getState(),
		progress: job.progress(),
		attempts: job.attemptsMade,
		maxAttempts: job.opts.attempts,
		data: job.data,
	};
};

/**
 * Clears all jobs from a queue (use with caution!)
 * @param {Queue} queue - BullMQ Queue instance
 * @param {Object} options - Clear options
 * @returns {Promise<void>}
 */
export const clearQueue = async (queue, options = {}) => {
	const { grace = 5000 } = options;
	try {
		await queue.clean(grace, 100);
	} catch (error) {
		logger.error(`Failed to clear queue "${queue.name}"`, {
			error: error.message,
		});
		throw error;
	}
};

/**
 * Gracefully closes all queues, workers, and listeners
 * Useful for process shutdown
 * @returns {Promise<void>}
 */
export const closeAllQueues = async () => {
	try {
		for (const [name, queue] of queues) {
			await queue.close();
			logger.info(`Queue "${name}" closed`);
		}
		queues.clear();
		queueConnections.clear();
	} catch (error) {
		logger.error("Failed to close queues during shutdown", {
			error: error.message,
		});
		throw error;
	}
};

/**
 * Health check for Redis connectivity
 * @returns {Promise<boolean>} True if Redis is accessible
 * @throws {ServiceError} When Redis is unreachable or misconfigured
 */
export const checkQueueHealth = async () => {
	const defaultRedisAddr = getRedisAddress();

	if (queues.size === 0) {
		// Create a temporary queue to test connectivity.
		// Attach a no-op error listener so ioredis connection errors don't
		// leak as unhandled 'error' events and print raw stack traces to stderr.
		const testQueue = new Queue("_health_check", {
			connection: getHealthCheckRedisConfig(),
		});
		testQueue.on("error", () => {});
		try {
			// BullMQ v5: queue.client is an async getter — must be awaited
			const client = await testQueue.client;
			await client.ping();
			return true;
		} catch (error) {
			const code = error.code ?? null;
			const detail = error.message || error.code || "connection failed";
			const suffix = code ? ` (${code})` : "";
			const summary = detail === code ? "" : `: ${detail}`;
			throw new ServiceError(
				"Redis",
				`Redis unavailable at ${defaultRedisAddr}${suffix}${summary}`,
				503,
			);
		} finally {
			// Always clean up the temporary queue
			await testQueue.close().catch(() => {});
		}
	}

	const [firstQueue] = queues.values();
	const redisAddr = getRedisAddress(queueConnections.get(firstQueue.name));

	try {
		// BullMQ v5: queue.client is an async getter — must be awaited
		const client = await firstQueue.client;
		await client.ping();
		return true;
	} catch (error) {
		const code = error.code ?? null;
		const detail = error.message || error.code || "connection failed";
		const suffix = code ? ` (${code})` : "";
		const summary = detail === code ? "" : `: ${detail}`;
		throw new ServiceError(
			"Redis",
			`Redis unavailable at ${redisAddr}${suffix}${summary}`,
			503,
		);
	}
};
