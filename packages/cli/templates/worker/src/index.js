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
	updateQueueDepths,
} from "@usequark/quark-core";
import { AppError } from "@usequark/quark-core/errors";
import { job, prisma } from "@usequark/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@usequark/quark-jobs";
import { jobHandlers } from "./handlers/index.js";

const logger = createLogger("worker");
const isDevMode =
	process.env.NODE_ENV !== "production" &&
	process.env.npm_lifecycle_event === "dev";

// Store workers for graceful shutdown
const workers = [];
let devDisabledKeepAlive = null;
let depthTimer = null;
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

export function getJobHandlerOrThrow(jobName) {
	const handler = jobHandlers[jobName];

	if (!handler) {
		throw new AppError(
			`No handler registered for job: ${jobName}`,
			500,
			"JOB_HANDLER_NOT_REGISTERED",
		);
	}

	return handler;
}

function disableWorkerInDev() {
	if (!devDisabledKeepAlive) {
		// Keep the process alive so the dev session stays healthy even when the
		// worker is intentionally disabled due to missing Redis.
		devDisabledKeepAlive = setInterval(() => {}, 60_000);
	}
}

export async function waitForWorkerReady(
	queueWorker,
	queueName,
	loggerInstance,
) {
	await queueWorker.waitUntilReady();
	loggerInstance.info(
		`Queue "${queueName}" worker started (concurrency: ${queueWorker.opts.concurrency})`,
	);
	return queueWorker;
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

	// See waitForDatabase: reject a config object in the healthCheck slot
	// rather than failing with an opaque TypeError.
	if (typeof healthCheck !== "function") {
		throw new AppError(
			"waitForRedis expects a health check function as its first argument.",
			500,
			"REDIS_HEALTH_CHECK_INVALID",
		);
	}

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
				throw new AppError(
					`Redis health check failed: ${error.message}`,
					503,
					"REDIS_HEALTH_CHECK_FAILED",
				);
			}
		}
	}

	// All retries exhausted
	throw new AppError(
		`Redis unavailable at ${getRedisUrl()} after ${maxRetries} attempts. Start Redis or check REDIS_URL/REDIS_HOST/REDIS_PORT.`,
		503,
		"REDIS_UNAVAILABLE",
	);
}

/**
 * Waits for the database schema to be ready (migrations applied).
 * Queries a known table to verify the schema exists, retrying on failure.
 * This prevents the "Failed to persist job event" error when the worker
 * starts before web service migrations finish.
 *
 * @param {Function} healthCheck - Async function that performs a DB query. Throws on failure.
 * @param {Object} config
 * @param {number} config.maxRetries - Maximum retry attempts (default: 30)
 * @param {number} config.intervalMs - Delay between retries in ms (default: 2000)
 * @returns {Promise<boolean>}
 */
export async function waitForDatabase(
	healthCheck = async () => {
		await prisma.$queryRaw`SELECT 1`;
		return true;
	},
	config = {},
) {
	const {
		maxRetries = parseInt(process.env.WORKER_DB_RETRIES || "30", 10),
		intervalMs = parseInt(process.env.WORKER_DB_INTERVAL_MS || "2000", 10),
	} = config;

	// Guard against the config object being passed in the healthCheck slot:
	// that surfaces as an opaque "healthCheck is not a function" TypeError and,
	// because a TypeError is neither a schema nor a connection error, it
	// rethrows on the first attempt so the retry config never applies.
	if (typeof healthCheck !== "function") {
		throw new AppError(
			"waitForDatabase expects a health check function as its first argument.",
			500,
			"DATABASE_HEALTH_CHECK_INVALID",
		);
	}

	const reportThrottledError = throttledError(logger, 5000);

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const isReady = await healthCheck();
			if (isReady) {
				logger.info(`Database schema ready (attempt ${attempt}/${maxRetries})`);
				return true;
			}
		} catch (error) {
			const message = (error.message || "") + (error.code || "");
			const isSchemaError =
				message.includes("relation") ||
				message.includes("table") ||
				message.includes("does not exist") ||
				message.includes("P2021") ||
				message.includes("P1000") ||
				message.includes("Can't reach database");

			if (isSchemaError || isConnectionError(error)) {
				reportThrottledError(error);
				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, intervalMs));
				}
			} else {
				// Non-schema error (e.g. query syntax) — fail immediately
				throw new AppError(
					`Database health check failed: ${error.message}`,
					503,
					"DATABASE_HEALTH_CHECK_FAILED",
				);
			}
		}
	}

	throw new AppError(
		`Database schema not ready after ${maxRetries} attempts. Ensure migrations have run.`,
		503,
		"DATABASE_SCHEMA_NOT_READY",
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
	const { loadEnv } = await import("@usequark/quark-config");
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

		// Validate handlers are registered for every known job name.
		// No queues are created here - handler presence is a registry check,
		// and createQueue() instances would only need closing again.
		logger.info("Checking job handler registration...");
		const handlerCount = Object.values(JOB_NAMES).filter(
			(jobName) => jobHandlers[jobName],
		).length;
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
 * Generic queue processor - dispatches jobs to registered handlers
 * @param {string} queueName
 */
async function createQueueWorker(queueName) {
	const queueWorker = createWorker(
		queueName,
		async (bullJob) => {
			const handler = getJobHandlerOrThrow(bullJob.name);

			return handler(bullJob, logger);
		},
		{
			concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
		},
	);

	workers.push(queueWorker);

	async function persistJob(bullJob, status, extra = {}) {
		try {
			await job.upsert(bullJob.id, {
				queue: queueName,
				name: bullJob.name,
				data: bullJob.data,
				attempts: bullJob.attemptsMade,
				status,
				...extra,
			});
		} catch (error) {
			logger.error("Failed to persist job event", {
				error: error.message,
				jobId: bullJob.id,
				status,
			});
		}
	}

	queueWorker.on("active", (bullJob) => {
		persistJob(bullJob, "IN_PROGRESS", { startedAt: new Date() });
	});

	queueWorker.on("completed", (bullJob, result) => {
		logger.info(`Job ${bullJob.id} (${bullJob.name}) completed`, { result });
		persistJob(bullJob, "COMPLETED", { completedAt: new Date() });
	});

	queueWorker.on("failed", (bullJob, error) => {
		logger.error(
			`Job ${bullJob.id} (${bullJob.name}) failed after ${bullJob.attemptsMade} attempts`,
			{
				error: error.message,
				jobName: bullJob.name,
				attemptsMade: bullJob.attemptsMade,
			},
		);
		persistJob(bullJob, "FAILED", {
			error: error.message,
			completedAt: new Date(),
		});
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

	return waitForWorkerReady(queueWorker, queueName, logger);
}

/**
 * Start the worker service
 */
async function startWorker() {
	// Load and validate environment variables
	const { loadEnv } = await import("@usequark/quark-config");
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

		// Wait for database schema to be ready (migrations may still be running)
		logger.info("Checking database schema readiness...");
		// healthCheck takes the first argument; the config object must not be
		// passed in its slot or the call throws "healthCheck is not a function".
		await waitForDatabase(
			undefined,
			isDevMode ? { maxRetries: 5, intervalMs: 1000 } : {},
		);
		logger.info("Database schema ready");

		// Register a worker for each queue
		await Promise.all(
			Object.values(JOB_QUEUES).map((queueName) =>
				createQueueWorker(queueName),
			),
		);

		// Schedule repeating cleanup job (runs every 24 hours)
		// Uses upsertJobScheduler for atomic registration - prevents duplicate schedulers on worker restart
		const filesQueue = createQueue(JOB_QUEUES.FILES);
		await filesQueue.upsertJobScheduler(
			"cleanup-orphaned-files",
			{ every: 24 * 60 * 60 * 1000 },
			{ name: JOB_NAMES.CLEANUP_ORPHANED_FILES, data: { retentionHours: 24 } },
		);

		// Keep job_queue_depth gauge current for Prometheus scraping.
		// Seed it immediately so the gauge isn't empty on the first scrape.
		updateQueueDepths().catch((error) => {
			logger.warn("Initial queue depth update failed", {
				error: error.message,
			});
		});
		depthTimer = setInterval(() => {
			updateQueueDepths().catch((error) => {
				logger.warn("Queue depth update failed", { error: error.message });
			});
		}, 30_000);

		logger.info("Worker service ready");
	} catch (error) {
		if (isDevMode && isConnectionError(error)) {
			logger.warn("Redis unavailable - worker disabled in dev", {
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
		if (depthTimer) {
			clearInterval(depthTimer);
			depthTimer = null;
		}

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
