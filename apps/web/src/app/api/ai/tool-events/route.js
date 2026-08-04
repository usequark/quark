import { getToolEvents } from "@techstream/quark-ai/audit";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

export async function GET(request) {
	try {
		const session = await requireAuth();
		const { searchParams } = new URL(request.url);
		const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
		const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

		const result = await getToolEvents({
			userId: session.user.id,
			limit,
			offset,
		});

		return NextResponse.json({ data: result.events, total: result.total });
	} catch (error) {
		return handleError(error);
	}
}
