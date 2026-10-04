/**
 * @usequark/quark-core - Multipart Parser
 *
 * Stream-based multipart/form-data parsing with early limit enforcement.
 * Works with Next.js App Router Request objects.
 */

import { Readable } from "node:stream";

/**
 * @typedef {Object} ParsedFile
 * @property {string} fieldName - Form field name
 * @property {string} filename - Original filename
 * @property {string} mimeType - MIME type from Content-Type header
 * @property {Buffer} buffer - Complete file content
 * @property {number} size - File size in bytes
 */

/**
 * @typedef {Object} ParseMultipartOptions
 * @property {number} [maxFileSize=10485760] - Max file size in bytes (default: 10MB)
 * @property {number} [maxFiles=5] - Max number of files per request
 * @property {number} [maxFields=20] - Max number of non-file fields
 */

/**
 * @typedef {Object} ParseMultipartResult
 * @property {ParsedFile[]} files - Parsed file uploads
 * @property {Record<string, string>} fields - Non-file form fields
 */

/**
 * Parse a multipart/form-data request into files and fields.
 *
 * @param {Request} request - Web API Request (Next.js App Router)
 * @param {ParseMultipartOptions} [options]
 * @returns {Promise<ParseMultipartResult>}
 */
export async function parseMultipart(request, options = {}) {
	const {
		maxFileSize = 10 * 1024 * 1024,
		maxFiles = 5,
		maxFields = 20,
	} = options;

	const contentType = request.headers.get("content-type");
	if (!contentType?.includes("multipart/form-data")) {
		throw new Error("Request is not multipart/form-data");
	}

	if (!request.body) {
		throw new Error("Request body is empty");
	}

	const { default: Busboy } = await import("busboy");

	return new Promise((resolve, reject) => {
		const files = [];
		const fields = {};
		let settled = false;

		function resolveOnce(result) {
			if (settled) return;
			settled = true;
			resolve(result);
		}

		function rejectOnce(error) {
			if (settled) return;
			settled = true;
			reject(error);
		}

		const busboy = Busboy({
			headers: { "content-type": contentType },
			limits: {
				fileSize: maxFileSize,
				files: maxFiles,
				fields: maxFields,
			},
		});

		busboy.on("file", (fieldName, stream, info) => {
			const { filename, mimeType } = info;
			const chunks = [];
			let size = 0;
			let truncated = false;

			stream.on("data", (chunk) => {
				size += chunk.length;
				chunks.push(chunk);
			});

			stream.on("limit", () => {
				truncated = true;
				stream.resume();
			});

			stream.on("error", rejectOnce);

			stream.on("end", () => {
				if (truncated) {
					rejectOnce(
						new Error(
							`File "${filename}" exceeds maximum size of ${(maxFileSize / (1024 * 1024)).toFixed(1)} MB`,
						),
					);
					return;
				}

				files.push({
					fieldName,
					filename: filename || "unknown",
					mimeType: mimeType || "application/octet-stream",
					buffer: Buffer.concat(chunks),
					size,
				});
			});
		});

		busboy.on("field", (name, value) => {
			fields[name] = value;
		});

		busboy.on("filesLimit", () => {
			rejectOnce(
				new Error(`Request exceeds maximum file count of ${maxFiles}`),
			);
		});

		busboy.on("fieldsLimit", () => {
			rejectOnce(
				new Error(`Request exceeds maximum field count of ${maxFields}`),
			);
		});

		busboy.on("error", rejectOnce);
		busboy.on("close", () => resolveOnce({ files, fields }));

		const nodeStream = Readable.fromWeb(request.body);
		nodeStream.on("error", rejectOnce);
		nodeStream.pipe(busboy);
	});
}
