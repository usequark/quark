import { validateBody } from "@usequark/quark-core";
import { prisma } from "@usequark/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractBearerPayload } from "../../../../lib/jwt";
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
export async function POST(request) {
	try {
		const payload = await extractBearerPayload(request);
		if (!payload?.sub) {
			return NextResponse.json(
				{ message: "Authentication required" },
				{ status: 401 },
			);
		}

		const userId = payload.sub;

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
}
