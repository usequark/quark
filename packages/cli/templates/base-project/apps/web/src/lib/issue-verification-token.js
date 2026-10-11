import { generateToken, hashToken } from "@usequark/quark-core/auth";
import { verificationToken } from "@usequark/quark-db";

/**
 * Lifetime of a password-reset link.
 *
 * An hour is enough for a mail to arrive and a person to act on it, and short
 * enough that a link found later in a mailbox archive is already dead. The
 * reset email quotes the same window; changing one without the other would make
 * the email lie.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Lifetime of an email-verification link.
 *
 * Longer than a reset: an address is confirmed on the user's own schedule, and
 * nothing is ambiently at risk while the link lives — redeeming it only sets
 * the verified flag, it does not grant a session.
 */
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Issues a single-use verification token for an identifier and returns the raw
 * value to embed in the emailed link.
 *
 * The stored row holds only the SHA-256 digest (`hashToken`), never the value
 * the link carries: a leaked database row must not be redeemable. Resolution
 * hashes the presented token before looking it up, so the two always meet.
 *
 * Any outstanding token for the identifier is deleted first. A user who clicks
 * "resend" twice should not leave two working links behind — the newest request
 * is the one they are looking at, and an old email in a shared inbox should
 * stop working the moment a replacement is issued.
 *
 * @param {string} identifier - The user's email address (the `VerificationToken`
 *   identifier column).
 * @param {number} ttlMs - Token lifetime in milliseconds.
 * @returns {Promise<string>} The raw token to place in the link. Not stored.
 */
export async function issueVerificationToken(identifier, ttlMs) {
	await verificationToken.deleteByIdentifier(identifier);

	const token = generateToken();
	await verificationToken.create({
		identifier,
		token: hashToken(token),
		expires: new Date(Date.now() + ttlMs),
	});

	return token;
}
