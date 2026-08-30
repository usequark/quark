import { validateBody } from "@techstream/quark-core";
import { user } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { issueTokenPair } from "../../../lib/jwt";
import { handleError } from "../../error-handler";

const googleAuthSchema = z.object({
	idToken: z.string().min(1),
});

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/**
 * POST /api/auth/google
 * Verify Google ID token and issue a custom JWT.
 */
export async function POST(request) {
	try {
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

		const googleEmail = tokenInfo.email;
		if (!googleEmail) {
			return NextResponse.json(
				{ message: "Google token does not contain an email" },
				{ status: 400 },
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
