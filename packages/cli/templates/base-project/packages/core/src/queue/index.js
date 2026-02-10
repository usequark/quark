/**
 * @quark/core - Job Queue Module
 * Provides BullMQ queue initialization and management
 */

import { Queue, QueueEvents, Worker } from "bullmq";

/**
 * Default Redis configuration
 */
const DEFAULT_REDIS_CONFIG = {
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT || "6379", 10),
	db: parseInt(process.env.REDIS_DB || "0", 10),
	retryStrategy: (times) => {
		const delay = Math.min(times * 50, 2000);
		return delay;
	},
};

/**
 * Map to store singleton queue instances
 */
const queues = new Map();

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
		redis = DEFAULT_REDIS_CONFIG,
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

	// Clean up on graceful shutdown
	queue.on("error", (error) => {
		console.error(`Queue "${name}" error:`, error);
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
		redis = DEFAULT_REDIS_CONFIG,
		concurrency = 1,
		...workerOptions
	} = options;

	const worker = new Worker(queueName, handler, {
		connection: redis,
		concurrency,
		...workerOptions,
	});

	worker.on("error", (error) => {
		console.error(`Worker for queue "${queueName}" error:`, error);
	});

	worker.on("failed", (job, error) => {
		console.error(
			`Job ${job.id} in queue "${queueName}" failed:`,
			error.message,
		);
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
	const { redis = DEFAULT_REDIS_CONFIG, ...eventsOptions } = options;

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
		const ServiceError = require("./errors.js").ServiceError;
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
		console.error(`Failed to clear queue "${queue.name}":`, error);
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
			console.log(`Queue "${name}" closed`);
		}
		queues.clear();
	} catch (error) {
		console.error("Failed to close queues:", error);
		throw error;
	}
};

/**
 * Health check for Redis connectivity
 * @returns {Promise<boolean>} True if Redis is accessible
 */
export const checkQueueHealth = async () => {
	try {
		if (queues.size === 0) {
			// Create a temporary queue to test connectivity
			const testQueue = new Queue("_health_check", {
				connection: DEFAULT_REDIS_CONFIG,
			});
			await testQueue.client.ping();
			await testQueue.close();
			return true;
		}

		const [firstQueue] = queues.values();
		await firstQueue.client.ping();
		return true;
	} catch (error) {
		console.error("Queue health check failed:", error);
		return false;
	}
};
