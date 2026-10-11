import { getAppUrl } from "@usequark/quark-config";
import { enqueueResetPasswordEmail } from "./enqueue-reset-password-email.js";
import {
	issueVerificationToken,
	RESET_TOKEN_TTL_MS,
} from "./issue-verification-token.js";

/**
 * Issues a password-reset link for an account and enqueues the email that
 * carries it.
 *
 * Kept out of the forgot-password route for the same reason the verification
 * equivalent is kept out of the register route: one place that defines how the
 * link is built, and one test for that definition.
 *
 * @param {{ id: string, email: string }} account - The account that requested a reset.
 * @returns {Promise<void>}
 */
export async function sendResetPasswordEmail(account) {
	const token = await issueVerificationToken(account.email, RESET_TOKEN_TTL_MS);
	const resetUrl = `${getAppUrl()}/auth/reset-password?token=${token}`;

	await enqueueResetPasswordEmail(account.id, resetUrl);
}
