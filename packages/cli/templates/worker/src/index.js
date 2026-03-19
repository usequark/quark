/**
 * Worker Service
 * Processes background jobs using BullMQ and Redis
 * Handles job execution, retries, and error tracking
 */

import {
	checkQueueHealth,
	createLogger,
	createQueue,
	createWorker,
	getRedisUrl,
} from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@techstream/quark-jobs";
import { jobHandlers } from "./handlers/index.js";

const logger = createLogger("worker");
const isDevMode =
	process.env.NODE_ENV !== "production" &&
	process.env.npm_lifecycle_event === "dev";

// Store workers for graceful shutdown
const workers = [];
let devDisabledKeepAlive = null;
let isShuttingDown = false;

// ============================================================================
// RESILIENCE UTILITIES
// ============================================================================

/**
 * Detects if error is a connection/network error
 * @param {Error} error
 * @returns {boolean}
 */
export function isConnectionError(error) {
	if (!error) return false;
	const message = (error.message || "") + (error.code || "");
	const connectionErrors = [
		"ECONNREFUSED", // Connection refused
		"ECONNRESET", // Connection reset
		"ENOTFOUND", // DNS lookup failure
		"ETIMEDOUT", // Connection timeout
		"EHOSTUNREACH", // Host unreachable
		"ENETUNREACH", // Network unreachable
		"Error: Redis connection failed", // Generic redis failure
		"Redis unavailable at", // Final wrapped startup error
		"Ready status is false", // BullMQ readiness
	];
	return connectionErrors.some((err) => message.includes(err));
}

/**
 * Creates a throttled error logger
 * Suppresses duplicate errors within a time window
 * @param {Object} logger
 * @param {number} windowMs - Throttle window in milliseconds
 * @returns {Function} throttle function
 */
export function throttledError(logger, windowMs = 5000) {
	let lastErrorTime = 0;
	let lastErrorMsg = "";

	return (error) => {
		const now = Date.now();
		const msg = error.message || String(error);

		// Log if new error type or window expired
		if (msg !== lastErrorMsg || now - lastErrorTime > windowMs) {
			logger.warn("Waiting for Redis", {
				reason: msg,
			});
			lastErrorTime = now;
			lastErrorMsg = msg;
		}
	};
}

function disableWorkerInDev() {
	if (!devDisabledKeepAlive) {
		// Keep the process alive so the dev session stays healthy even when the
		// worker is intentionally disabled due to missing Redis.
		devDisabledKeepAlive = setInterval(() => {}, 60_000);
	}
}

/**
 * Waits for Redis to be ready with retries
 * @param {Function} healthCheck - Async function that returns boolean or throws
 * @param {Object} config
 * @param {number} config.maxRetries - Maximum retry attempts
 * @param {number} config.intervalMs - Delay between retries
 * @returns {Promise<boolean>}
 */
export async function waitForRedis(
	healthCheck = checkQueueHealth,
	config = {},
) {
	const {
		maxRetries = parseInt(process.env.WORKER_HEALTH_RETRIES || "10", 10),
		intervalMs = parseInt(process.env.WORKER_HEALTH_INTERVAL_MS || "1000", 10),
	} = config;

	const reportThrottledError = throttledError(logger, 3000);

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const isReady = await healthCheck();
			if (isReady) {
				logger.info(
					`Redis health check passed (attempt ${attempt}/${maxRetries})`,
				);
				return true;
			}
		} catch (error) {
			if (isConnectionError(error)) {
				reportThrottledError(error);
				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, intervalMs));
				}
			} else {
				throw new Error(`Redis health check failed: ${error.message}`);
			}
		}
	}

	// All retries exhausted
	throw new Error(
		`Redis unavailable at ${getRedisUrl()} after ${maxRetries} attempts. Start Redis or check REDIS_URL/REDIS_HOST/REDIS_PORT.`,
	);
}

// ============================================================================
// PREFLIGHT MODE
// ============================================================================

/**
 * Runs pre-flight health checks and exits
 * Used for deployment readiness probes
 */
async function preflight() {
	// Load and validate environment variables
	const { loadEnv } = await import("@techstream/quark-config");
	loadEnv("worker");

	logger.info("Running preflight health checks");

	try {
		// Check Redis
		logger.info("Checking Redis connectivity...");
		await checkQueueHealth();
		logger.info("✓ Redis connected");

		// Check Database
		logger.info("Checking database connectivity...");
		await prisma.$queryRaw`SELECT 1`;
		logger.info("✓ Database connected");

		// Validate handlers are registered
		logger.info("Checking job handler registration...");
		let handlerCount = 0;
		for (const queueName of Object.values(JOB_QUEUES)) {
			const queue = createQueue(queueName);
			for (const jobName of Object.values(JOB_NAMES)) {
				if (jobHandlers[jobName]) {
					handlerCount++;
				}
			}
			await queue.close();
		}
		logger.info(`✓ ${handlerCount} job handlers registered`);

		logger.info("✓ All preflight checks passed");
		process.exit(0);
	} catch (error) {
		logger.error("Preflight check failed", {
			error: error.message,
			stack: error.stack,
		});
		process.exit(1);
	}
}

/**
 * Generic queue processor — dispatches jobs to registered handlers
 * @param {string} queueName
 */
function createQueueWorker(queueName) {
	const queueWorker = createWorker(
		queueName,
		async (bullJob) => {
			const handler = jobHandlers[bullJob.name];

			if (!handler) {
				throw new Error(`No handler registered for job: ${bullJob.name}`);
			}

			return handler(bullJob, logger);
		},
		{
			concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
		},
	);

	workers.push(queueWorker);

	queueWorker.on("completed", (job, result) => {
		logger.info(`Job ${job.id} (${job.name}) completed`, { result });
	});

	queueWorker.on("failed", (job, error) => {
		logger.error(
			`Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts`,
			{
				error: error.message,
				jobName: job.name,
				attemptsMade: job.attemptsMade,
			},
		);
	});

	queueWorker.on("stalled", (jobId) => {
		logger.warn(`Job ${jobId} in queue "${queueName}" has stalled`, {
			queueName,
			jobId,
		});
	});

	queueWorker.on("error", (error) => {
		logger.error(`Worker error in queue "${queueName}"`, {
			error: error.message,
			queueName,
		});
	});

	logger.info(
		`Queue "${queueName}" worker started (concurrency: ${queueWorker.opts.concurrency})`,
	);

	return queueWorker;
}

/**
 * Start the worker service
 */
async function startWorker() {
	// Load and validate environment variables
	const { loadEnv } = await import("@techstream/quark-config");
	loadEnv("worker");

	logger.info("Starting Quark Worker Service");

	try {
		// Pre-flight: Wait for Redis with health checks and retries
		logger.info("Performing health checks...");
		await waitForRedis(
			checkQueueHealth,
			isDevMode ? { maxRetries: 3, intervalMs: 500 } : {},
		);

		logger.info("Redis connected", { address: getRedisUrl() });
		// Register a worker for each queue
		for (const queueName of Object.values(JOB_QUEUES)) {
			createQueueWorker(queueName);
		}

		// Schedule repeating cleanup job (runs every 24 hours)
		const filesQueue = createQueue(JOB_QUEUES.FILES);
		await filesQueue.add(
			JOB_NAMES.CLEANUP_ORPHANED_FILES,
			{ retentionHours: 24 },
			{
				repeat: { every: 24 * 60 * 60 * 1000 }, // 24h
				jobId: "cleanup-orphaned-files-repeat",
			},
		);

		logger.info("Worker service ready");
	} catch (error) {
		if (isDevMode && isConnectionError(error)) {
			logger.warn("Redis unavailable — worker disabled in dev", {
				action:
					"Start Redis and restart the worker when background jobs are needed.",
			});
			disableWorkerInDev();
			return;
		}

		logger.error("Failed to start worker service", {
			error: error.message,
		});
		process.exit(1);
	}
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal = "unknown") {
	if (isShuttingDown) {
		logger.warn("Shutdown already in progress", { signal });
		return;
	}

	isShuttingDown = true;
	logger.info("Shutting down worker service", { signal });

	try {
		if (devDisabledKeepAlive) {
			clearInterval(devDisabledKeepAlive);
			devDisabledKeepAlive = null;
		}

		for (const worker of workers) {
			await worker.close();
		}

		try {
			await prisma.$disconnect();
		} catch (error) {
			if (error.message?.includes("environment variable is required")) {
				logger.warn("Skipping Prisma disconnect due missing database env", {
					error: error.message,
				});
			} else {
				throw error;
			}
		}

		logger.info("All workers closed");
		process.exit(0);
	} catch (error) {
		logger.error("Error during shutdown", {
			error: error.message,
			stack: error.stack,
		});
		process.exit(1);
	}
}

process.on("SIGTERM", () => {
	void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
	void shutdown("SIGINT");
});

// ============================================================================
// ENTRY POINT
// ============================================================================

// Only start the worker if this file is being run directly
// Convert file:// URL to path for comparison
const currentFile = new URL(import.meta.url).pathname;
const mainModule = process.argv[1];
const isMainModule = currentFile === mainModule;

if (isMainModule) {
	if (process.argv.includes("--preflight")) {
		void preflight();
	} else {
		void startWorker();
	}
}
