import { getAppUrl } from "@usequark/quark-config";
import { enqueueVerificationEmail } from "./enqueue-verification-email.js";
import {
	issueVerificationToken,
	VERIFY_TOKEN_TTL_MS,
} from "./issue-verification-token.js";

/**
 * Issues a verification link for an account and enqueues the email that carries
 * it.
 *
 * Kept out of the register route so the route reads as "create the user, then
 * hand off" and so this sequence has one test that does not have to stand up
 * the whole registration path. The route treats any failure here as
 * non-fatal — the account exists either way.
 *
 * @param {{ id: string, email: string }} account - The freshly created user.
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail(account) {
	const token = await issueVerificationToken(
		account.email,
		VERIFY_TOKEN_TTL_MS,
	);
	const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${token}`;

	await enqueueVerificationEmail(account.id, verifyUrl);
}
