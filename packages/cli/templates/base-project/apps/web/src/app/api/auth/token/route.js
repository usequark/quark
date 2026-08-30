import {
	createLogger,
	getAuthSecret,
	validateBody,
	verifyPassword,
} from "@techstream/quark-core";
import { user } from "@techstream/quark-db";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "../../error-handler";

const logger = createLogger("auth-token");

const tokenRequestSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "30d";

/**
 * POST /api/auth/token
 * Exchange email + password for JWT tokens.
 * Used by the mobile app for Bearer-token auth.
 */
export async function POST(request) {
	try {
		const { email, password } = await validateBody(request, tokenRequestSchema);

		const existingUser = await user.findByEmail(email);
		if (!existingUser || !existingUser.password) {
			return NextResponse.json(
				{ message: "Invalid credentials" },
				{ status: 401 },
			);
		}

		const isValid = await verifyPassword(password, existingUser.password);
		if (!isValid) {
			return NextResponse.json(
				{ message: "Invalid credentials" },
				{ status: 401 },
			);
		}

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
			.setExpirationTime(ACCESS_TOKEN_EXPIRY)
			.setIssuer("quark-mobile")
			.sign(secretKey);

		const refreshToken = await new SignJWT({
			sub: existingUser.id,
			type: "refresh",
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt(now)
			.setExpirationTime(REFRESH_TOKEN_EXPIRY)
			.setIssuer("quark-mobile")
			.sign(secretKey);

		const expiresAt = new Date(now * 1000 + 60 * 60 * 1000).toISOString();

		return NextResponse.json({ token, refreshToken, expiresAt });
	} catch (error) {
		return handleError(error);
	}
}
