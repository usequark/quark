import {
	createLogger,
	getAuthSecret,
	validateBody,
} from "@techstream/quark-core";
import { user } from "@techstream/quark-db";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "../../error-handler";

const logger = createLogger("auth-google");

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

		// Issue custom JWT
		const secret = getAuthSecret();
		if (!secret) {
			logger.error("NEXTAUTH_SECRET not configured");
			return NextResponse.json(
				{ message: "Server configuration error" },
				{ status: 500 },
			);
		}

		const secretKey = new TextEncoder().encode(secret);
		const now = Math.floor(Date.now() / 1000);

		const token = await new SignJWT({
			sub: existingUser.id,
			email: existingUser.email,
			name: existingUser.name,
			role: existingUser.role,
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt(now)
			.setExpirationTime("1h")
			.setIssuer("quark-mobile")
			.sign(secretKey);

		const refreshToken = await new SignJWT({
			sub: existingUser.id,
			type: "refresh",
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt(now)
			.setExpirationTime("30d")
			.setIssuer("quark-mobile")
			.sign(secretKey);

		const expiresAt = new Date(now * 1000 + 60 * 60 * 1000).toISOString();

		return NextResponse.json({ token, refreshToken, expiresAt });
	} catch (error) {
		return handleError(error);
	}
}
