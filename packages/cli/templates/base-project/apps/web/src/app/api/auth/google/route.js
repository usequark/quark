import {
	getGoogleClientId,
	isAudienceValid,
} from "@usequark/quark-config/oauth";
import { validateBody } from "@usequark/quark-core/core";
import { user } from "@usequark/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { issueTokenPair } from "../../../../lib/jwt";
import { handleError } from "../../error-handler";

const googleAuthSchema = z.object({
	idToken: z.string().min(1),
});

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/**
 * Whether Google's `email_verified` claim says the address is confirmed.
 *
 * `tokeninfo` returns the claim as the *string* `"true"` or `"false"`, not a
 * boolean, so a plain truthiness check would do the exact opposite of the
 * obvious thing: reject every real sign-in (`"false"` is truthy) while waving
 * through the one case that matters. Only an explicit confirmation counts.
 * Anything else — a missing claim, a number, a null — is unverified, because
 * the failure modes here are asymmetric: a wrong refusal costs one unlucky
 * sign-in, and a wrong acceptance hands an unconfirmed address a session.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmailVerified(value) {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return false;
	return value.trim().toLowerCase() === "true";
}

/**
 * POST /api/auth/google
 * Verify Google ID token and issue a custom JWT.
 */
export async function POST(request) {
	try {
		const clientId = getGoogleClientId();

		// Fail closed when unconfigured. This route is public — it does not need
		// your frontend to call it, or anyone to have set up Google sign-in — so
		// "nobody configured it" is not a reason to keep serving. Without a client
		// id there is no audience to compare `tokeninfo.aud` against, and a route
		// that skips the comparison accepts any token Google ever issued to any
		// app for this address. Refusing is the only safe default.
		if (!clientId) {
			return NextResponse.json(
				{ message: "Google sign-in is not configured on this server" },
				{ status: 503 },
			);
		}

		const { idToken } = await validateBody(request, googleAuthSchema);

		// Verify the token with Google's tokeninfo endpoint
		const tokenInfoResponse = await fetch(
			`${GOOGLE_TOKENINFO_URL}?id_token=${idToken}`,
		);

		if (!tokenInfoResponse.ok) {
			return NextResponse.json(
				{ message: "Invalid Google token" },
				{ status: 401 },
			);
		}

		const tokenInfo = await tokenInfoResponse.json();

		// The audience is the OAuth client id the token was minted for. Google
		// verified the signature; it did not verify the token was for *this* app. A
		// token Google issued to a different app for the victim's address is
		// genuine and correctly signed, and must still be refused — otherwise
		// anyone who can get the victim to sign in to any Google app at all can log
		// in as them here.
		if (!isAudienceValid(tokenInfo.aud, clientId)) {
			return NextResponse.json(
				{ message: "Invalid Google token" },
				{ status: 401 },
			);
		}

		const googleEmail = tokenInfo.email;
		if (!googleEmail) {
			return NextResponse.json(
				{ message: "Google token does not contain an email" },
				{ status: 400 },
			);
		}

		// An unverified address proves nothing about who controls the inbox, and
		// this route creates the account on first sight — so without this check the
		// confirmation that is supposed to establish ownership of the address is
		// the attacker's to skip rather than the victim's to perform.
		//
		// It sits after the missing-email `400` on purpose. That one describes the
		// shape of the token rather than reporting that the token was refused, and
		// putting this check ahead of it would change a response operators already
		// read for what it is. What matters for security is the position relative
		// to the database: both checks land before `findByEmail`, so an unverified
		// address can never become a registration or existence oracle.
		if (!isEmailVerified(tokenInfo.email_verified)) {
			return NextResponse.json(
				{ message: "Invalid Google token" },
				{ status: 401 },
			);
		}

		// Find or create user
		let existingUser = await user.findByEmail(googleEmail);
		if (!existingUser) {
			existingUser = await user.create({
				email: googleEmail,
				name: tokenInfo.name || null,
			});
		}

		const { token, refreshToken, expiresAt } =
			await issueTokenPair(existingUser);
		return NextResponse.json({ token, refreshToken, expiresAt });
	} catch (error) {
		return handleError(error);
	}
}
