/**
 * @techstream/quark-core - Job Queue Module
 * Provides BullMQ queue initialization and management
 */

import { Queue, QueueEvents, Worker } from "bullmq";
import { ServiceError } from "../errors.js";
import { createLogger } from "../logger.js";
import { jobDuration, jobQueueDepth, jobsProcessedTotal } from "../metrics.js";
import { resolveRedisConnection } from "../redis.js";

const logger = createLogger("queue");

/**
 * Returns the default Redis config for BullMQ connections.
 * Evaluated lazily so env vars set after module load (e.g. via dotenv) are respected.
 * Uses resolveRedisConnection() - supports REDIS_URL, REDIS_HOST/REDIS_PORT, and localhost fallback.
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
		retryStrategy: () => null, // don't auto-retry - let waitForRedis control the loop
	};
}

/**
 * Map to store singleton queue instances
 */
const queues = new Map();
const queueConnections = new Map();

/**
 * Evicts a queue instance from the singleton registries.
 * Only evicts when this exact instance is the registered one, so a stale
 * close() can never remove a newer queue created under the same name.
 * @param {string} name - Queue name
 * @param {Queue} queue - Queue instance being evicted
 */
const evictQueue = (name, queue) => {
	if (queues.get(name) === queue) {
		queues.delete(name);
		queueConnections.delete(name);
	}
};

/**
 * Best-effort check for an already-closed BullMQ queue.
 * Prefers a public isClosed() when BullMQ exposes one; BullMQ 5 has none,
 * so fall back to QueueBase's own `closing`/`closed` fields.
 * @param {Queue} queue - Queue instance
 * @returns {boolean}
 */
const isQueueClosed = (queue) => {
	if (typeof queue.isClosed === "function") {
		return queue.isClosed();
	}
	return Boolean(queue.closing || queue.closed);
};

const getRedisAddress = (redisConfig) => {
	const cfg = redisConfig || getDefaultRedisConfig();
	return `${cfg.host}:${cfg.port}`;
};

/**
 * Creates or retrieves a singleton BullMQ queue.
 *
 * Close-safe: `queue.close()` evicts the instance from the registry, so a
 * later `createQueue(name)` returns a fresh, usable queue instead of the
 * closed one. While open, repeated calls return the same instance.
 *
 * @param {string} name - Queue name
 * @param {Object} options - Queue options
 * @param {Object} options.redis - Redis connection config
 * @param {Object} options.defaultJobOptions - Default job options
 * @returns {Queue} BullMQ Queue instance
 */
export const createQueue = (name, options = {}) => {
	const existing = queues.get(name);
	if (existing) {
		// A closed queue is unusable - never hand it out again.
		// (close() evicts below; this is a defensive check for a queue closed
		// through some other path, e.g. during shutdown.)
		if (isQueueClosed(existing)) {
			evictQueue(name, existing);
		} else {
			return existing;
		}
	}

	const {
		redis = getDefaultRedisConfig(),
		defaultJobOptions = {
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
			removeOnComplete: { age: 60, count: 100 },
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

	// Close-safe singleton: closing a queue evicts it from the registry so the
	// next createQueue(name) builds a fresh instance instead of returning a
	// poisoned, already-closed one. Eviction happens regardless of whether
	// close() resolves - a failed close leaves the instance equally unusable.
	const originalClose = queue.close.bind(queue);
	queue.close = async (...closeArgs) => {
		try {
			return await originalClose(...closeArgs);
		} finally {
			evictQueue(name, queue);
		}
	};

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

	worker.on("completed", (job) => {
		jobsProcessedTotal.inc({ queue: queueName, status: "completed" });
		if (job.processedOn != null && job.finishedOn != null) {
			jobDuration.observe(
				{ queue: queueName, name: job.name },
				(job.finishedOn - job.processedOn) / 1000,
			);
		}
	});

	worker.on("failed", (job, error) => {
		logger.error(`Job ${job?.id} in queue "${queueName}" failed`, {
			jobId: job?.id,
			queue: queueName,
			error: error.message,
			attempts: job?.attemptsMade,
		});
		jobsProcessedTotal.inc({ queue: queueName, status: "failed" });
		if (job?.processedOn != null && job?.finishedOn != null) {
			jobDuration.observe(
				{ queue: queueName, name: job.name },
				(job.finishedOn - job.processedOn) / 1000,
			);
		}
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
 * Utility to add a job to a queue with error handling.
 * Supports optional deduplication via a caller-provided dedupKey.
 * When dedupKey is set, uses Redis SET NX to atomically check-and-set,
 * preventing duplicate job creation within the dedupTTL window.
 *
 * @param {Queue} queue - BullMQ Queue instance
 * @param {string} jobName - Job name/type (e.g., 'send-welcome-email')
 * @param {Object} data - Job data
 * @param {Object} jobOptions - Job-specific options
 * @param {string} [jobOptions.dedupKey] - Unique key for deduplication. If set, only one job
 *   with this key will be created within the dedupTTL window.
 * @param {number} [jobOptions.dedupTTL=86400] - TTL in seconds for the dedup key (default 24h).
 *   The dedup key auto-expires, allowing legitimate re-sends after the TTL.
 * @returns {Promise<Job|null>} Queued job, or null if a duplicate was detected and skipped.
 * @throws {ServiceError} When the job fails to queue (not on dedup skip).
 */
export const addJob = async (queue, jobName, data, jobOptions = {}) => {
	// Extract dedup options before passing to BullMQ - it doesn't recognize them
	const { dedupKey, dedupTTL, ...bullOptions } = jobOptions;

	// Optional deduplication: caller provides a key that identifies unique work.
	// Uses Redis SET NX for atomic check-and-set - no race conditions.
	if (dedupKey) {
		try {
			const client = await queue.client;
			const dedupRedisKey = `job:dedup:${queue.name}:${jobName}:${dedupKey}`;
			const ttl = dedupTTL ?? 86_400; // 24h default
			const acquired = await client.set(dedupRedisKey, "1", "NX", "EX", ttl);
			if (!acquired) {
				return null; // Duplicate detected, silently skip
			}
		} catch (error) {
			// Dedup is best-effort - if Redis fails, let the job through rather than block
			const logger = createLogger("queue:addJob");
			logger.warn("Dedup check failed, allowing job through", {
				error: error.message,
				jobName,
				dedupKey,
			});
		}
	}

	try {
		const job = await queue.add(jobName, data, bullOptions);
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
 * Atomically registers or updates a repeatable job scheduler.
 * Uses BullMQ's upsertJobScheduler (Redis Lua script) to prevent duplicate
 * schedulers on worker restart - unlike queue.add() + repeat which is not atomic.
 *
 * @param {Queue} queue - BullMQ Queue instance
 * @param {string} schedulerId - Unique identifier for this scheduler (e.g. 'cleanup-orphaned-files')
 * @param {string} jobName - Job name/type (e.g., 'cleanup-orphaned-files')
 * @param {Object} data - Job data passed to each execution
 * @param {Object} repeatOptions - BullMQ repeat options (pattern or every + optional tz)
 * @param {string} [repeatOptions.pattern] - Cron pattern (e.g. '0 8 * * *')
 * @param {number} [repeatOptions.every] - Interval in milliseconds (e.g. 86400000)
 * @param {string} [repeatOptions.tz] - Timezone for cron pattern (e.g. 'Pacific/Auckland')
 * @returns {Promise<JobScheduler>} The upserted job scheduler
 */
export const addRepeatableJob = async (
	queue,
	schedulerId,
	jobName,
	data,
	repeatOptions,
) => {
	return queue.upsertJobScheduler(schedulerId, repeatOptions, {
		name: jobName,
		data,
	});
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
		// Iterate over a snapshot: close() evicts each queue from the Map via
		// the close-safe wrapper, so a live iteration would mutate as we walk it.
		for (const [name, queue] of [...queues]) {
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
			// BullMQ v5: queue.client is an async getter - must be awaited
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
		// BullMQ v5: queue.client is an async getter - must be awaited
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

/**
 * Returns all registered queue instances.
 * @returns {Map<string, Queue>}
 */
export const getRegisteredQueues = () => queues;

/**
 * Refreshes the job_queue_depth gauge for all registered queues.
 * Call periodically (e.g. every 30 s) in the worker to keep the gauge accurate.
 * @returns {Promise<void>}
 */
export const updateQueueDepths = async () => {
	for (const [name, queue] of queues) {
		try {
			const waiting = await queue.getWaitingCount();
			jobQueueDepth.set({ queue: name }, waiting);
		} catch (error) {
			// Non-critical - depth gauge is best-effort
			logger.warn(`Failed to update depth gauge for queue "${name}"`, {
				error: error.message,
			});
		}
	}
};
