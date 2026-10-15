import { hashPassword, hashToken } from "@usequark/quark-core/auth";
import { validateBody, withCsrfProtection } from "@usequark/quark-core/core";
import { ValidationError } from "@usequark/quark-core/errors";
import { passwordSchema, user, verificationToken } from "@usequark/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "../../error-handler";

const resetPasswordSchema = z.object({
	token: z.string().min(1, "A reset token is required"),
	password: passwordSchema,
});

/**
 * The message used for every refused reset: unknown token, expired token, or
 * account gone. An attacker probing a stolen link learns nothing from which
 * wording comes back, because they are the same.
 */
const UNUSABLE_LINK_MESSAGE =
	"This reset link is invalid or has expired. Request a new one.";

/**
 * Loads the token row for a presented token, or null when there is none usable.
 *
 * The row is found by the SHA-256 digest, never by the raw value — that is the
 * entire point of storing the digest in the first place. Expiry is checked
 * here so both GET and POST agree on what "usable" means, and so a consumed
 * (deleted) token is indistinguishable from one that never existed.
 *
 * @param {string | null} rawToken - The token from the link's query string.
 * @returns {Promise<object | null>} The `VerificationToken` row, or null.
 */
async function resolveToken(rawToken) {
	if (!rawToken) return null;

	const record = await verificationToken.findByToken(hashToken(rawToken));
	if (!record) return null;
	if (record.expires.getTime() <= Date.now()) return null;

	return record;
}

/**
 * Answers whether a link is still usable, so the reset page can render the form
 * or an error before the user types a new password into a dead form.
 *
 * GET is safe (no state change) and so is not CSRF-protected; the lookup is a
 * single indexed primary-key read.
 */
export async function GET(request) {
	try {
		const token = new URL(request.url).searchParams.get("token");
		const record = await resolveToken(token);

		return NextResponse.json(
			{ valid: Boolean(record) },
			{ status: record ? 200 : 400 },
		);
	} catch (error) {
		return handleError(error);
	}
}

export const POST = withCsrfProtection(async (request) => {
	try {
		const { token, password } = await validateBody(
			request,
			resetPasswordSchema,
		);
		const record = await resolveToken(token);

		if (!record) {
			throw new ValidationError(UNUSABLE_LINK_MESSAGE);
		}

		const account = await user.findByEmail(record.identifier);
		if (!account) {
			// The account was deleted after the link was issued. The link is dead
			// either way; burn the token so it cannot be tried a second time.
			await verificationToken.deleteByIdentifier(record.identifier);
			throw new ValidationError(UNUSABLE_LINK_MESSAGE);
		}

		const hashedPassword = await hashPassword(password);
		await user.update(account.id, {
			password: hashedPassword,
			// Stamping the change is what reaches every live session even though
			// both are self-contained tokens: `validateSessionToken` refuses a web
			// JWT issued before this instant, and `POST /api/auth/refresh` refuses
			// a mobile refresh token issued before it — so a password known to an
			// attacker stops working the moment it is replaced.
			passwordChangedAt: new Date(),
		});

		// Single-use: the token dies with the reset it performed. Replaying the
		// same link must not overwrite the new password with another.
		await verificationToken.deleteByIdentifier(account.email);

		return NextResponse.json({
			message: "Your password has been updated. You can now sign in.",
		});
	} catch (error) {
		return handleError(error);
	}
});
