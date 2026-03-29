/**
 * File Upload API
 * POST /api/files - Upload a file (multipart/form-data)
 * GET  /api/files - List current user's files
 */

import {
	createStorage,
	generateStorageKey,
	parseMultipart,
	parsePaginationQuery,
	validateFile,
	withCsrfProtection,
} from "@techstream/quark-core";
import { file } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

/**
 * POST /api/files
 * Upload one or more files via multipart/form-data.
 * Requires authentication.
 */
export const POST = withCsrfProtection(async (request) => {
	try {
		const session = await requireAuth();

		// Parse multipart body
		const { files: parsedFiles } = await parseMultipart(request);

		if (parsedFiles.length === 0) {
			return NextResponse.json(
				{ message: "No files provided" },
				{ status: 400 },
			);
		}

		const storage = createStorage();
		const results = [];

		for (const parsed of parsedFiles) {
			// Validate each file
			const validation = validateFile({
				filename: parsed.filename,
				mimeType: parsed.mimeType,
				size: parsed.size,
				buffer: parsed.buffer,
			});

			if (!validation.valid) {
				return NextResponse.json(
					{ message: validation.error, filename: parsed.filename },
					{ status: 422 },
				);
			}

			// Generate storage key and upload
			const storageKey = generateStorageKey(parsed.filename);

			await storage.put(storageKey, parsed.buffer, {
				contentType: parsed.mimeType,
			});

			// Save metadata to database
			const record = await file.create({
				filename: storageKey.split("/").pop(),
				originalName: parsed.filename,
				mimeType: parsed.mimeType,
				size: parsed.size,
				storageKey,
				storageProvider: storage.provider,
				uploadedById: session.user.id,
			});

			results.push({
				id: record.id,
				originalName: record.originalName,
				mimeType: record.mimeType,
				size: record.size,
				url: `/api/files/${record.id}`,
				createdAt: record.createdAt,
			});
		}

		const status = results.length === 1 ? 201 : 200;
		const body = results.length === 1 ? results[0] : { files: results };

		return NextResponse.json(body, { status });
	} catch (error) {
		return handleError(error);
	}
});

/**
 * GET /api/files
 * List files uploaded by the current user.
 */
export async function GET(request) {
	try {
		const session = await requireAuth();

		const { searchParams } = new URL(request.url);
		const { skip, take } = parsePaginationQuery(searchParams);
		const files = await file.findByUploader(session.user.id, { skip, take });

		const mapped = files.map((f) => ({
			id: f.id,
			originalName: f.originalName,
			mimeType: f.mimeType,
			size: f.size,
			url: `/api/files/${f.id}`,
			createdAt: f.createdAt,
		}));

		return NextResponse.json(mapped);
	} catch (error) {
		return handleError(error);
	}
}
