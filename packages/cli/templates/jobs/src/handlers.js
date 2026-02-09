import { JOB_NAMES } from "./definitions.js";

export async function sendWelcomeEmail(job) {
	const { email } = job.data;
	console.log(`Sending welcome email to ${email}`);
	// Add your email sending logic here
	return { success: true };
}

export async function sendResetPasswordEmail(job) {
	const { email } = job.data;
	console.log(`Sending reset password email to ${email}`);
	// Add your email sending logic here
	return { success: true };
}

export const jobHandlers = {
	[JOB_NAMES.SEND_WELCOME_EMAIL]: sendWelcomeEmail,
	[JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: sendResetPasswordEmail,
};
