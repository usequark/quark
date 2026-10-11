import { getAppUrl } from "@usequark/quark-config";
import { hashToken } from "@usequark/quark-core/auth";
import { createLogger } from "@usequark/quark-core/core";
import { user, verificationToken } from "@usequark/quark-db";
import { NextResponse } from "next/server";

const logger = createLogger("auth:verify-email");

/**
 * Redeems an emailed verification link.
 *
 * A GET performs the state change because that is the shape of an emailed
 * link — a mail client fetches it by navigation, not by posting JSON. The
 * consequence is a bearer link: whoever holds it can confirm the address, so
 * the same threat model as the reset flow applies — the token is 256 bits of
 * randomness, stored only as a SHA-256 digest, and single-use.
 *
 * Outcomes funnel into the sign-in page through `?verified=`:
 *   - `1`      - address confirmed (or already confirmed)
 *   - `invalid` - no token, expired, consumed, or the account is gone
 *   - `error`  - something broke server-side; logged, and the caller still
 *     lands somewhere useful rather than on a bare 500
 */
export async function GET(request) {
	const base = getAppUrl();

	try {
		const token = new URL(request.url).searchParams.get("token");
		const record = token
			? await verificationToken.findByToken(hashToken(token))
			: null;

		if (!record || record.expires.getTime() <= Date.now()) {
			return NextResponse.redirect(`${base}/auth/signin?verified=invalid`);
		}

		const account = await user.findByEmail(record.identifier);
		if (!account) {
			// The account is gone; the confirmation would be for nobody. Burn the
			// token and refuse rather than leaving a live link sitting in an
			// inbox.
			await verificationToken.deleteByIdentifier(record.identifier);
			return NextResponse.redirect(`${base}/auth/signin?verified=invalid`);
		}

		if (!account.emailVerified) {
			await user.update(account.id, { emailVerified: new Date() });
		}
		await verificationToken.deleteByIdentifier(account.email);

		return NextResponse.redirect(`${base}/auth/signin?verified=1`);
	} catch (error) {
		logger.error("Email verification failed", {
			message: error?.message ?? String(error),
		});
		return NextResponse.redirect(`${base}/auth/signin?verified=error`);
	}
}
