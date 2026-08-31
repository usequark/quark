import { createLogger, validateBody } from "@techstream/quark-core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { issueTokenPair, verifyMobileToken } from "../../../../lib/jwt";
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

		const payload = await verifyMobileToken(refreshToken);
		if (!payload) {
			logger.warn("Invalid refresh token");
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

		const { token } = await issueTokenPair({
			id: payload.sub,
			email: payload.email,
			name: payload.name,
			role: payload.role,
		});

		return NextResponse.json({ token });
	} catch (error) {
		return handleError(error);
	}
}
