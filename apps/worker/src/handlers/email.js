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

/**
 * Job handler for SEND_GOVERNANCE_ALERT
 * Sends an email notification when a project governance threshold is breached.
 * @param {import("bullmq").Job} bullJob
 * @param {import("@techstream/quark-core").Logger} logger
 */
export async function handleSendGovernanceAlert(bullJob, logger) {
	const { projectId, projectName, tier, violations, adminEmail } = bullJob.data;

	if (!adminEmail) {
		logger.warn("No adminEmail provided — skipping governance alert email");
		return { skipped: true };
	}

	logger.info("Sending governance alert email", {
		job: JOB_NAMES.SEND_GOVERNANCE_ALERT,
		projectId,
		projectName,
		tier,
		violationCount: violations?.length,
	});

	const violationList = (violations || [])
		.map(
			(v) =>
				`  • ${v.metric}: ${v.delta.toFixed(2)} (threshold: ${v.threshold})`,
		)
		.join("\n");

	const appName = process.env.APP_NAME || "Quark";
	const appUrl = process.env.APP_URL || "";
	const subject = `[${appName}] Governance Violation — ${projectName}`;
	const html = `
		<h2>Governance Threshold Breached</h2>
		<p><strong>Project:</strong> ${projectName}</p>
		<p><strong>Tier:</strong> ${tier}</p>
		<p><strong>Project ID:</strong> ${projectId}</p>
		<hr/>
		<h3>Violations</h3>
		<pre>${violationList}</pre>
		<hr/>
		<p>An alert has been raised. Review project resource usage and take action if needed.</p>
		${appUrl ? `<p><a href="${appUrl}/admin/deployments/${projectId}">View in Dashboard →</a></p>` : ""}
	`;
	const text = `Governance Threshold Breached\n\nProject: ${projectName}\nTier: ${tier}\nProject ID: ${projectId}\n\nViolations:\n${violationList}\n\nAn alert has been raised. Review project resource usage and take action if needed.${appUrl ? `\n\nView in Dashboard: ${appUrl}/admin/deployments/${projectId}` : ""}`;

	await emailService.sendEmail(adminEmail, subject, html, text);

	return { success: true, projectId, email: adminEmail };
}
