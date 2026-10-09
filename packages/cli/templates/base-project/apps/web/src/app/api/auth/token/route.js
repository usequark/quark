import { verifyPassword } from "@usequark/quark-core/auth";
import { validateBody } from "@usequark/quark-core/core";
import { user } from "@usequark/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { issueTokenPair } from "../../../../lib/jwt";
import { handleError } from "../../error-handler";

const tokenRequestSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

/**
 * POST /api/auth/token
 * Exchange email + password for JWT tokens.
 * Used by the mobile app for Bearer-token auth.
 */
export async function POST(request) {
	try {
		const { email, password } = await validateBody(request, tokenRequestSchema);

		const existingUser = await user.findByEmail(email);
		if (!existingUser?.password) {
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

		const { token, refreshToken, expiresAt } =
			await issueTokenPair(existingUser);
		return NextResponse.json({ token, refreshToken, expiresAt });
	} catch (error) {
		return handleError(error);
	}
}
