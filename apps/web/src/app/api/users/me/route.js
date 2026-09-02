import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { user, userUpdateSchema } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { extractBearerPayload } from "../../../../lib/jwt";
import { handleError } from "../../error-handler";

/**
 * Extract the authenticated user's ID from the Bearer token.
 * Returns null and sends a 401 response if not authenticated.
 */
async function requireBearerUser(request) {
	const payload = await extractBearerPayload(request);
	if (!payload?.sub) {
		return {
			userId: null,
			response: NextResponse.json(
				{ message: "Authentication required" },
				{ status: 401 },
			),
		};
	}
	return { userId: payload.sub, response: null };
}

/**
 * GET /api/users/me
 * Return the authenticated user's profile.
 * Requires a valid Bearer JWT (mobile app auth).
 */
export async function GET(request) {
	try {
		const { userId, response } = await requireBearerUser(request);
		if (response) return response;

		const foundUser = await user.findById(userId);
		if (!foundUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		return NextResponse.json(foundUser);
	} catch (error) {
		return handleError(error);
	}
}

/**
 * PATCH /api/users/me
 * Update the authenticated user's profile.
 * Requires a valid Bearer JWT (mobile app auth).
 */
export const PATCH = withCsrfProtection(async (request) => {
	try {
		const { userId, response } = await requireBearerUser(request);
		if (response) return response;

		const existingUser = await user.findById(userId);
		if (!existingUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		const data = await validateBody(request, userUpdateSchema);
		const updatedUser = await user.update(userId, data);
		return NextResponse.json(updatedUser);
	} catch (error) {
		return handleError(error);
	}
});
