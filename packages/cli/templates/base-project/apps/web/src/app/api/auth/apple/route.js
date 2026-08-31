import { validateBody } from "@techstream/quark-core";
import { user } from "@techstream/quark-db";
import { importJWK, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { issueTokenPair } from "../../../../lib/jwt";
import { handleError } from "../../error-handler";

const appleAuthSchema = z.object({
	identityToken: z.string().min(1),
	nonce: z.string().optional(),
});

const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";

/**
 * POST /api/auth/apple
 * Verify Apple identity token and issue a custom JWT.
 */
export async function POST(request) {
	try {
		const { identityToken } = await validateBody(request, appleAuthSchema);

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

		// Verify the token using Apple's public key
		const publicKey = await importJWK(matchingKey, "RS256");

		let payload;
		try {
			const result = await jwtVerify(identityToken, publicKey, {
				issuer: "https://appleid.apple.com",
			});
			payload = result.payload;
		} catch {
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
