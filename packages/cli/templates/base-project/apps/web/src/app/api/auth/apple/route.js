import { createHash, timingSafeEqual } from "node:crypto";
import { getAppleClientIds } from "@usequark/quark-config/oauth";
import { validateBody } from "@usequark/quark-core";
import { user } from "@usequark/quark-db";
import { importJWK, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { issueTokenPair } from "../../../../lib/jwt";
import { handleError } from "../../error-handler";

const appleAuthSchema = z.object({
	identityToken: z.string().min(1),
	nonce: z.string().min(1),
});

const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";

/**
 * SHA-256 of a UTF-8 string, lowercase hex — the same digest the mobile client
 * computes before handing it to Apple as the sign-in nonce.
 *
 * @param {string} value
 * @returns {string}
 */
function sha256Hex(value) {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * POST /api/auth/apple
 * Verify Apple identity token and issue a custom JWT.
 */
export async function POST(request) {
	try {
		const clientIds = getAppleClientIds();

		// Fail closed when unconfigured. This route is public, so an unconfigured
		// deployment must not keep authenticating people — see the note in the
		// Google route for the full reasoning.
		if (!clientIds) {
			return NextResponse.json(
				{ message: "Apple sign-in is not configured on this server" },
				{ status: 503 },
			);
		}

		const { identityToken, nonce } = await validateBody(
			request,
			appleAuthSchema,
		);

		// Decode the JWT header to get the kid
		const [headerB64] = identityToken.split(".");
		const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());

		// Fetch Apple's public keys
		const keysResponse = await fetch(APPLE_KEYS_URL);
		const { keys } = await keysResponse.json();

		// Find the matching key
		const matchingKey = keys.find((k) => k.kid === header.kid);
		if (!matchingKey) {
			return NextResponse.json(
				{ message: "Invalid Apple token: no matching key" },
				{ status: 401 },
			);
		}

		// Verify the token using Apple's public key. `audience` is what binds the
		// identity token to this app: without it, an identity token Apple issued
		// to a different bundle or service id for the same Apple ID verifies fine
		// and would be exchanged for a first-party session.
		//
		// Apple identity tokens can carry *either* the bundle identifier (native
		// iOS) *or* the Services ID (web flow) as their `aud` claim, depending on
		// which flow the client uses. Passing both accepts either.
		const publicKey = await importJWK(matchingKey, "RS256");

		let payload;
		try {
			const result = await jwtVerify(identityToken, publicKey, {
				issuer: "https://appleid.apple.com",
				audience: clientIds,
			});
			payload = result.payload;
		} catch {
			return NextResponse.json(
				{ message: "Invalid Apple token" },
				{ status: 401 },
			);
		}

		// The nonce is Apple's replay defence. The client sends a raw nonce and
		// hands Apple its SHA-256 digest; Apple returns that digest in the token's
		// `nonce` claim. Re-hashing what we received is what proves this token was
		// minted for *this* sign-in attempt rather than lifted from an earlier one.
		//
		// Both halves must be present. A token with no `nonce` claim proves nothing
		// about which attempt it came from, so treating "the client sent no nonce" as
		// "skip the check" would leave the replay window open to any caller who
		// simply omits the field.
		if (typeof payload.nonce !== "string" || payload.nonce === "") {
			return NextResponse.json(
				{ message: "Invalid Apple token" },
				{ status: 401 },
			);
		}

		const expectedNonce = sha256Hex(nonce);
		if (!safeEqualStrings(expectedNonce, payload.nonce)) {
			return NextResponse.json(
				{ message: "Invalid Apple token" },
				{ status: 401 },
			);
		}

		const appleEmail = payload.email;
		if (!appleEmail) {
			return NextResponse.json(
				{ message: "Apple token does not contain an email" },
				{ status: 400 },
			);
		}

		// Find or create user
		let existingUser = await user.findByEmail(appleEmail);
		if (!existingUser) {
			existingUser = await user.create({
				email: appleEmail,
				name: payload.name
					? `${payload.name.firstName || ""} ${payload.name.lastName || ""}`.trim()
					: null,
			});
		}

		const { token, refreshToken, expiresAt } =
			await issueTokenPair(existingUser);
		return NextResponse.json({ token, refreshToken, expiresAt });
	} catch (error) {
		return handleError(error);
	}
}

/**
 * Constant-time string comparison.
 *
 * `timingSafeEqual` throws when the two buffers differ in length, so the length
 * check has to come first. It short-circuits on length — which is fine, because
 * both sides are fixed-length hex digests here, so length is not a secret.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqualStrings(a, b) {
	const aBuf = Buffer.from(a, "utf8");
	const bBuf = Buffer.from(b, "utf8");
	if (aBuf.length !== bBuf.length) return false;
	return timingSafeEqual(aBuf, bBuf);
}
