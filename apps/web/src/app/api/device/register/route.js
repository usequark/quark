import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "../../error-handler";

const deviceRegisterSchema = z.object({
	platform: z.enum(["ios", "android"]),
	pushToken: z.string().min(1),
	deviceId: z.string().min(1),
});

/**
 * POST /api/device/register
 * Register a mobile device for push notifications.
 * Requires authentication via Bearer token.
 */
export const POST = withCsrfProtection(async (request) => {
	try {
		// Extract user ID from Bearer token
		const authHeader = request.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return NextResponse.json(
				{ message: "Authentication required" },
				{ status: 401 },
			);
		}

		// Verify the JWT to get the user ID
		const { jwtVerify } = await import("jose");
		const { getAuthSecret } = await import("@techstream/quark-core");
		const secret = getAuthSecret();
		if (!secret) {
			return NextResponse.json(
				{ message: "Server configuration error" },
				{ status: 500 },
			);
		}

		const token = authHeader.slice(7);
		let payload;
		try {
			const result = await jwtVerify(token, new TextEncoder().encode(secret), {
				issuer: "quark-mobile",
			});
			payload = result.payload;
		} catch {
			return NextResponse.json(
				{ message: "Invalid or expired token" },
				{ status: 401 },
			);
		}

		const userId = payload.sub;
		if (!userId) {
			return NextResponse.json(
				{ message: "Invalid token: no user ID" },
				{ status: 401 },
			);
		}

		const { platform, pushToken, deviceId } = await validateBody(
			request,
			deviceRegisterSchema,
		);

		// Upsert device record
		await prisma.device.upsert({
			where: {
				userId_deviceId: { userId, deviceId },
			},
			update: {
				pushToken,
				platform,
			},
			create: {
				userId,
				platform,
				pushToken,
				deviceId,
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
});
