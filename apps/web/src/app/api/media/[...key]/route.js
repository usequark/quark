/**
 * CMS Media Serving API
 * GET /api/media/[...key] — Serve a media asset by storage key.
 *
 * Only serves files that are registered in the MediaAsset table.
 * This prevents serving arbitrary files from storage (IDOR protection).
 * Media assets are public-facing (no auth required) since they are intended
 * for use in public pages.
 */

import { createStorage, NotFoundError } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { handleError } from "../../error-handler";

const storage = createStorage();

export async function GET(_request, { params }) {
	try {
		const { key: keyParts } = await params;

		// Reconstruct the storage key from path segments
		const storageKey = keyParts
			.map((part) => decodeURIComponent(part))
			.join("/");

		// Verify the storage key exists in the MediaAsset table (IDOR protection).
		// This prevents serving arbitrary files from the storage bucket.
		const asset = await prisma.mediaAsset.findUnique({
			where: { storageKey },
			select: { mimeType: true, filename: true },
		});

		if (!asset) {
			throw new NotFoundError("Media asset not found");
		}

		const { body, contentType } = await storage.get(storageKey);

		const mimeType = contentType || asset.mimeType;
		const isImage = mimeType.startsWith("image/");
		const safeName = asset.filename.replace(/[\\"\r\n]/g, "_");
		const encodedName = encodeURIComponent(asset.filename);

		const headers = new Headers();
		headers.set("Content-Type", mimeType);
		headers.set("Content-Length", String(body.length));
		headers.set("Cache-Control", "public, max-age=31536000, immutable");
		headers.set(
			"Content-Disposition",
			isImage
				? `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`
				: `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
		);

		return new Response(body, { status: 200, headers });
	} catch (error) {
		return handleError(error);
	}
}
