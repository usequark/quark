/**
 * Email Job Handlers
 * Processes email-related background jobs
 */

import {
	createEmailService,
	passwordResetEmail,
	welcomeEmail,
} from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES } from "@techstream/quark-jobs";
import {
	requireResetPasswordEmailData,
	requireUserEmailRecord,
	requireWelcomeEmailUserId,
} from "./email-job-validation.js";

const emailService = createEmailService();

/**
 * Job handler for SEND_WELCOME_EMAIL
 * @param {import("bullmq").Job} bullJob
 * @param {import("@techstream/quark-core").Logger} logger
 */
export async function handleSendWelcomeEmail(bullJob, logger) {
	const userId = requireWelcomeEmailUserId(bullJob.data);

	logger.info(`Sending welcome email for user ${userId}`, {
		job: JOB_NAMES.SEND_WELCOME_EMAIL,
		userId,
	});

	const userRecord = requireUserEmailRecord(
		userId,
		await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, name: true },
		}),
	);

	const template = welcomeEmail({
		name: userRecord.name,
		appName: process.env.APP_NAME,
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
 * @param {import("bullmq").Job} bullJob
 * @param {import("@techstream/quark-core").Logger} logger
 */
export async function handleSendResetPasswordEmail(bullJob, logger) {
	const { userId, resetUrl } = requireResetPasswordEmailData(bullJob.data);

	logger.info(`Sending password reset email for user ${userId}`, {
		job: JOB_NAMES.SEND_RESET_PASSWORD_EMAIL,
		userId,
	});

	const userRecord = requireUserEmailRecord(
		userId,
		await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, name: true },
		}),
	);

	const template = passwordResetEmail({
		name: userRecord.name,
		appName: process.env.APP_NAME,
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
