/**
 * Worker Service
 * Processes background jobs using BullMQ and Redis
 * Handles job execution, retries, and error tracking
 */

import {
	createLogger,
	createQueue,
	createWorker,
} from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@techstream/quark-jobs";
import { jobHandlers } from "./handlers/index.js";

const logger = createLogger("worker");

// Store workers for graceful shutdown
const workers = [];

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
	logger.info("Starting Quark Worker Service");

	try {
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
		logger.error("Failed to start worker service", {
			error: error.message,
			stack: error.stack,
		});
		process.exit(1);
	}
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
	logger.info("Shutting down worker service");

	try {
		for (const worker of workers) {
			await worker.close();
		}

		await prisma.$disconnect();

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

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startWorker();

// Register shutdown handlers
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the worker service
startWorker();
