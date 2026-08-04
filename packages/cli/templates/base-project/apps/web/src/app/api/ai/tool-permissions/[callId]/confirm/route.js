import { getSharedRedisClient } from "@techstream/quark-config";
import { AppError, validateBody } from "@techstream/quark-core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../../../../error-handler";

const confirmSchema = z.object({
	approved: z.boolean(),
});

/**
 * POST /api/ai/tool-permissions/:callId/confirm
 * Publishes the user's approve/deny decision for a pending tool call.
 */
export async function POST(request, { params }) {
	try {
		await requireAuth();
		const { callId } = await params;

		if (!callId || typeof callId !== "string") {
			throw new AppError("callId is required", 400, "CALL_ID_REQUIRED");
		}

		const data = await validateBody(request, confirmSchema);
		const client = await getSharedRedisClient();

		if (!client) {
			throw new AppError(
				"Confirmation service unavailable",
				503,
				"REDIS_UNAVAILABLE",
			);
		}

		const channel = `ai:tool-confirm:${callId}`;
		await client.publish(
			channel,
			JSON.stringify({ approved: data.approved, callId }),
		);

		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
}
