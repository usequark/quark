import {
	createLogger,
	getAuthSecret,
	validateBody,
} from "@techstream/quark-core";
import { jwtVerify, SignJWT } from "jose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "../../error-handler";

const logger = createLogger("auth-refresh");

const refreshRequestSchema = z.object({
	refreshToken: z.string().min(1),
});

/**
 * POST /api/auth/refresh
 * Exchange a refresh token for a new access token.
 */
export async function POST(request) {
	try {
		const { refreshToken } = await validateBody(request, refreshRequestSchema);

		const secret = getAuthSecret();
		if (!secret) {
			logger.error("NEXTAUTH_SECRET not configured");
			return NextResponse.json(
				{ message: "Server configuration error" },
				{ status: 500 },
			);
		}

		const secretKey = new TextEncoder().encode(secret);

		let payload;
		try {
			const result = await jwtVerify(refreshToken, secretKey, {
				issuer: "quark-mobile",
			});
			payload = result.payload;
		} catch (error) {
			logger.warn("Invalid refresh token", { error: error.message });
			return NextResponse.json(
				{ message: "Invalid or expired refresh token" },
				{ status: 401 },
			);
		}

		if (payload.type !== "refresh") {
			return NextResponse.json(
				{ message: "Invalid token type" },
				{ status: 401 },
			);
		}

		const now = Math.floor(Date.now() / 1000);

		const token = await new SignJWT({
			sub: payload.sub,
			email: payload.email,
			name: payload.name,
			role: payload.role,
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt(now)
			.setExpirationTime("1h")
			.setIssuer("quark-mobile")
			.sign(secretKey);

		return NextResponse.json({ token });
	} catch (error) {
		return handleError(error);
	}
}
