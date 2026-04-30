/**
 * GET /api/cms/media
 * Returns a list of media assets for use in the CoverImageField picker.
 * Requires admin or cms role.
 */

import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

export async function GET() {
	try {
		await requireRole(["admin", "editor"]);

		const assets = await prisma.mediaAsset.findMany({
			where: { mimeType: { startsWith: "image/" } },
			orderBy: { createdAt: "desc" },
			take: 100,
			select: {
				id: true,
				filename: true,
				storageKey: true,
				mimeType: true,
				alt: true,
			},
		});

		return NextResponse.json({ assets });
	} catch (error) {
		return handleError(error);
	}
}
