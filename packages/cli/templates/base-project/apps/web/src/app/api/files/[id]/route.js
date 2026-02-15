/**
 * Single File API
 * GET    /api/files/[id] - Download / serve a file
 * DELETE /api/files/[id] - Delete a file (owner or admin only)
 */

import {
	createStorage,
	ForbiddenError,
	NotFoundError,
	withCsrfProtection,
} from "@techstream/quark-core";
import { file } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

/**
 * GET /api/files/[id]
 * Serve / download a file by its database ID.
 * Public endpoint (no auth required) — access control is by knowledge of ID.
 */
export async function GET(_request, { params }) {
	try {
		const { id } = await params;

		const record = await file.findById(id);
		if (!record) {
			throw new NotFoundError("File not found");
		}

		const storage = createStorage();
		const { body, contentType } = await storage.get(record.storageKey);

		const headers = new Headers();
		headers.set("Content-Type", contentType || record.mimeType);
		headers.set("Content-Length", String(body.length));
		headers.set("Cache-Control", "public, max-age=31536000, immutable");

		// Inline display for images; attachment download for everything else
		const isImage = record.mimeType.startsWith("image/");
		const safeName = record.originalName.replace(/[\\"\r\n]/g, "_");
		const encodedName = encodeURIComponent(record.originalName);
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

/**
 * DELETE /api/files/[id]
 * Delete a file. Only the uploader or an admin can delete.
 */
export const DELETE = withCsrfProtection(async (_request, { params }) => {
	try {
		const session = await requireAuth();
		const { id } = await params;

		const record = await file.findById(id);
		if (!record) {
			throw new NotFoundError("File not found");
		}

		// Authorization: uploader or admin
		const isOwner = record.uploadedById === session.user.id;
		const isAdmin = session.user.role === "admin";
		if (!isOwner && !isAdmin) {
			throw new ForbiddenError("You can only delete your own files");
		}

		// Remove from storage
		const storage = createStorage();
		await storage.delete(record.storageKey);

		// Remove database record
		await file.delete(record.id);

		return NextResponse.json({ message: "File deleted" });
	} catch (error) {
		return handleError(error);
	}
});
