import { AppError, ValidationError } from "@usequark/quark-core/errors";

export function requireWelcomeEmailUserId(data) {
	const userId = data?.userId;

	if (!userId) {
		throw new ValidationError("userId is required for SEND_WELCOME_EMAIL job");
	}

	return userId;
}

export function requireResetPasswordEmailData(data) {
	const userId = data?.userId;
	const resetUrl = data?.resetUrl;

	if (!userId || !resetUrl) {
		throw new ValidationError(
			"userId and resetUrl are required for SEND_RESET_PASSWORD_EMAIL job",
		);
	}

	return { userId, resetUrl };
}

export function requireUserEmailRecord(userId, userRecord) {
	if (!userRecord?.email) {
		throw new AppError(
			`User ${userId} not found or has no email`,
			404,
			"USER_EMAIL_NOT_FOUND",
		);
	}

	return userRecord;
}
