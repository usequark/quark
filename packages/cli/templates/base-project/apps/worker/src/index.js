/**
 * Worker Service
 * Processes background jobs using BullMQ and Redis
 * Handles job execution, retries, and error tracking
 */

import {
	createEmailService,
	createLogger,
	createWorker,
	passwordResetEmail,
	welcomeEmail,
} from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@techstream/quark-jobs";

const logger = createLogger("worker");

// Store workers for graceful shutdown
const workers = [];

// Initialize email service
const emailService = createEmailService();

/**
 * Job handler for SEND_WELCOME_EMAIL
 * @param {Job} bullJob - BullMQ job object
 */
async function handleSendWelcomeEmail(bullJob) {
	const { userId } = bullJob.data;

	if (!userId) {
		throw new Error("userId is required for SEND_WELCOME_EMAIL job");
	}

	logger.info(`Sending welcome email for user ${userId}`, {
		job: JOB_NAMES.SEND_WELCOME_EMAIL,
		userId,
	});

	const userRecord = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true, name: true },
	});

	if (!userRecord?.email) {
		throw new Error(`User ${userId} not found or has no email`);
	}

	const template = welcomeEmail({
		name: userRecord.name,
		loginUrl: process.env.APP_URL
			? `${process.env.APP_URL}/api/auth/signin`
			: undefined,
	});

	await emailService.sendEmail(
		userRecord.email,
		template.subject,
		template.html,
		template.text,
	);

	return { success: true, userId, email: userRecord.email };
}

/**
 * Job handler for SEND_RESET_PASSWORD_EMAIL
 * @param {Job} bullJob - BullMQ job object
 */
async function handleSendResetPasswordEmail(bullJob) {
	const { userId, resetUrl } = bullJob.data;

	if (!userId || !resetUrl) {
		throw new Error(
			"userId and resetUrl are required for SEND_RESET_PASSWORD_EMAIL job",
		);
	}

	logger.info(`Sending password reset email for user ${userId}`, {
		job: JOB_NAMES.SEND_RESET_PASSWORD_EMAIL,
		userId,
	});

	const userRecord = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true, name: true },
	});

	if (!userRecord?.email) {
		throw new Error(`User ${userId} not found or has no email`);
	}

	const template = passwordResetEmail({
		name: userRecord.name,
		resetUrl,
	});

	await emailService.sendEmail(
		userRecord.email,
		template.subject,
		template.html,
		template.text,
	);

	return { success: true, userId, email: userRecord.email };
}

/**
 * Initialize job handlers
 * Maps job names to their handler functions
 */
const jobHandlers = {
	[JOB_NAMES.SEND_WELCOME_EMAIL]: handleSendWelcomeEmail,
	[JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: handleSendResetPasswordEmail,
};

/**
 * Start the worker service
 * Creates workers for all queues and registers handlers
 */
async function startWorker() {
	logger.info("Starting Quark Worker Service");

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
			logger.info(`Job ${job.id} (${job.name}) completed`, { result });
		});

		emailQueueWorker.on("failed", (job, error) => {
			logger.error(
				`Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts`,
				{
					error: error.message,
					jobName: job.name,
					attemptsMade: job.attemptsMade,
				},
			);
		});

		logger.info(
			`Email queue worker started (concurrency: ${emailQueueWorker.opts.concurrency})`,
		);

		// Ready to process jobs
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
		// Close all workers
		for (const worker of workers) {
			await worker.close();
		}

		// Disconnect Prisma client
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

// Register shutdown handlers
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the worker service
startWorker();
