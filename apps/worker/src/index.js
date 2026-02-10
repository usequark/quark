/**
 * Worker Service
 * Processes background jobs using BullMQ and Redis
 * Handles job execution, retries, and error tracking
 */

import { createWorker } from "@Bobnoddle/quark-core";
import { JOB_NAMES, JOB_QUEUES } from "@Bobnoddle/quark-jobs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Store workers for graceful shutdown
const workers = [];

/**
 * Job handler for SEND_WELCOME_EMAIL
 * @param {Job} bullJob - BullMQ job object
 */
async function handleSendWelcomeEmail(bullJob) {
	const { userId } = bullJob.data;

	if (!userId) {
		throw new Error("userId is required for SEND_WELCOME_EMAIL job");
	}

	// TODO: Implement actual email sending when email service is ready
	console.log(
		`[${JOB_NAMES.SEND_WELCOME_EMAIL}] Processing for user ${userId}`,
	);

	// Simulate email sending
	await new Promise((resolve) => setTimeout(resolve, 1000));

	return { success: true, userId };
}

/**
 * Initialize job handlers
 * Maps job names to their handler functions
 */
const jobHandlers = {
	[JOB_NAMES.SEND_WELCOME_EMAIL]: handleSendWelcomeEmail,
};

/**
 * Start the worker service
 * Creates workers for all queues and registers handlers
 */
async function startWorker() {
	console.log("🚀 Starting Quark Worker Service...");

	try {
		// Create worker for email queue
		const emailQueueWorker = createWorker(
			JOB_QUEUES.EMAIL,
			async (bullJob) => {
				const handler = jobHandlers[bullJob.name];

				if (!handler) {
					throw new Error(`No handler registered for job: ${bullJob.name}`);
				}

				return handler(bullJob);
			},
			{
				concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
			},
		);

		workers.push(emailQueueWorker);

		emailQueueWorker.on("completed", (job, result) => {
			console.log(`✅ Job ${job.id} (${job.name}) completed:`, result);
		});

		emailQueueWorker.on("failed", (job, error) => {
			console.error(
				`❌ Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts:`,
				error.message,
			);
		});

		console.log(
			`✓ Email queue worker started (concurrency: ${emailQueueWorker.opts.concurrency})`,
		);

		// Ready to process jobs
		console.log("✓ Worker service ready");
	} catch (error) {
		console.error("Failed to start worker service:", error);
		process.exit(1);
	}
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
	console.log("\n🛑 Shutting down worker service...");

	try {
		// Close all workers
		for (const worker of workers) {
			await worker.close();
		}

		console.log("✓ All workers closed");
		process.exit(0);
	} catch (error) {
		console.error("Error during shutdown:", error);
		process.exit(1);
	}
}

// Register shutdown handlers
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the worker service
startWorker();
