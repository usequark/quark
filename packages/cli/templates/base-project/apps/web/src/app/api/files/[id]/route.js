/**
 * Single File API
 * GET    /api/files/[id] - Download / serve a file
 * DELETE /api/files/[id] - Delete a file (owner or admin only)
 */

import {
	ConflictError,
	createLogger,
	createStorage,
	ForbiddenError,
	NotFoundError,
	withCsrfProtection,
} from "@usequark/quark-core";
import { file } from "@usequark/quark-db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const logger = createLogger("files");

/**
 * GET /api/files/[id]
 * Serve / download a file by its database ID.
 * Public endpoint (no auth required) - access control is by knowledge of ID.
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
 *
 * Order matters: the database row goes first, the storage object second.
 *
 * `File` has no incoming relations today, so nothing can make the row delete
 * fail on a foreign key — but a future incoming relation with a restrictive
 * `onDelete` will, and at that point this ordering is what keeps the storage
 * object intact. The old order (storage, then row) destroyed the bytes first,
 * so a refused row delete left a row pointing at a blob that no longer existed:
 * unrecoverable, because the bytes are the only copy and they are already gone.
 *
 * `deleteIfPresent` also closes the concurrent-delete race. Two overlapping
 * requests both pass the ownership check above; the row delete reports how many
 * rows it removed, so only the request that actually removed the row goes on to
 * delete the storage object. The loser returns 404 without touching storage.
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

		// Remove the database record first. This is the reversible step: if the
		// storage delete below fails, we have an orphaned blob, which is junk but
		// harmless. The reverse order risks a row whose bytes are already gone.
		let deleted;
		try {
			({ count: deleted } = await file.deleteIfPresent(record.id));
		} catch (error) {
			// P2003: a foreign key still references this row. Reachable once File
			// gains incoming relations; the storage object is untouched at this point.
			if (error?.code === "P2003") {
				throw new ConflictError("File is referenced and cannot be deleted");
			}
			throw error;
		}

		// count === 0 means a concurrent request already removed the row. It owns
		// the storage cleanup; touching it here would race that request's delete.
		if (deleted === 0) {
			throw new NotFoundError("File not found");
		}

		// Row is gone, so the blob is now unreferenced. This is the irreversible
		// step and deliberately last.
		const storage = createStorage();
		try {
			await storage.delete(record.storageKey);
		} catch (error) {
			// The row is already deleted, so the delete as a whole succeeded from the
			// caller's point of view. Reporting an error would be a lie the client
			// cannot act on, and the leftover blob is recoverable via the existing
			// orphaned-file cleanup job. Log it rather than swallow it.
			logger.error("Failed to remove file from storage", {
				fileId: record.id,
				error: error?.message ?? String(error),
			});
		}

		return NextResponse.json({ message: "File deleted" });
	} catch (error) {
		return handleError(error);
	}
});
