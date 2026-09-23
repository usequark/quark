/**
 * @techstream/quark-core - File Storage
 *
 * Adapter-based storage abstraction supporting local filesystem and
 * S3-compatible providers (AWS S3, Cloudflare R2, MinIO, etc.).
 *
 * The S3 adapter lives in its own module (storage-s3.js) and loads the
 * AWS SDK lazily, so importing this file — or the main barrel — never
 * requires `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` to be
 * installed. Apps using `STORAGE_PROVIDER=s3` must install them (the
 * scaffolded web app declares both as dependencies).
 *
 * Usage:
 *   const storage = createStorage();  // reads STORAGE_PROVIDER env
 *   await storage.put(key, buffer, { contentType: "image/png" });
 *   const { body, contentType } = await storage.get(key);
 *   await storage.delete(key);
 */

import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

// Import + re-export the S3 adapter so existing deep-imports continue
// to work (`import { createS3Storage } from "@techstream/quark-core/storage"`).
// storage-s3.js has no top-level AWS SDK imports, so this stays safe for
// local-only deployments that never installed the optional peer deps.
import { createS3Storage } from "./storage-s3.js";

export { createS3Storage };

/**
 * Resolves a storage key against the base directory and guards against
 * path-traversal attacks.  Throws if the resolved path escapes baseDir.
 *
 * @param {string} baseDir - Absolute base directory
 * @param {string} key     - Caller-supplied storage key
 * @returns {string} Absolute, validated file path
 */
function safePath(baseDir, key) {
	const resolved = resolve(baseDir, key);
	const relativePath = relative(baseDir, resolved);
	if (
		relativePath === ".." ||
		relativePath.startsWith(`..${sep}`) ||
		isAbsolute(relativePath)
	) {
		throw new Error("Path traversal detected - key escapes storage directory");
	}
	return resolved;
}

// ---------------------------------------------------------------------------
// Local Storage Adapter
// ---------------------------------------------------------------------------

/**
 * Creates a local-filesystem storage adapter.
 * @param {Object} options
 * @param {string} [options.directory="./uploads"] - Base directory for files
 * @returns {StorageAdapter}
 */
export function createLocalStorage(options = {}) {
	const baseDir = resolve(
		options.directory || process.env.STORAGE_LOCAL_DIR || "./uploads",
	);

	return {
		provider: "local",

		async put(key, data, _meta = {}) {
			const filePath = safePath(baseDir, key);
			await mkdir(dirname(filePath), { recursive: true });

			if (Buffer.isBuffer(data) || typeof data === "string") {
				const ws = createWriteStream(filePath);
				ws.end(data);
				await new Promise((res, rej) => {
					ws.on("finish", res);
					ws.on("error", rej);
				});
			} else if (data && typeof data.pipe === "function") {
				await pipeline(data, createWriteStream(filePath));
			} else {
				throw new Error("put() expects a Buffer, string, or Readable stream");
			}

			return { key, provider: "local" };
		},

		async get(key) {
			const filePath = safePath(baseDir, key);
			const buffer = await readFile(filePath);
			return { body: buffer, contentType: null };
		},

		async delete(key) {
			const filePath = safePath(baseDir, key);
			try {
				await unlink(filePath);
			} catch (err) {
				if (err.code !== "ENOENT") throw err;
			}
		},

		async exists(key) {
			const filePath = safePath(baseDir, key);
			try {
				await stat(filePath);
				return true;
			} catch {
				return false;
			}
		},

		getPublicUrl(key) {
			// Local files are served via the API route, not a public URL
			return `/api/files/${encodeURIComponent(key)}`;
		},

		async getSignedUploadUrl(_key, _options = {}) {
			throw new Error(
				"getSignedUploadUrl() requires STORAGE_PROVIDER=s3. " +
					"For local development, upload files via POST /api/files instead.",
			);
		},
	};
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a storage adapter based on STORAGE_PROVIDER env var.
 *   "local" (default) → local filesystem
 *   "s3"              → S3-compatible (AWS, R2, MinIO)
 *
 * The S3 adapter is imported from storage-s3.js, which defers the AWS SDK
 * import to the first adapter call. Local-only apps therefore never need
 * the optional `@aws-sdk/*` peer dependencies installed.
 *
 * @param {Object} [options] - Override options passed to the adapter
 * @returns {StorageAdapter}
 */
export function createStorage(options = {}) {
	const provider = options.provider || process.env.STORAGE_PROVIDER || "local";

	switch (provider) {
		case "s3":
			return createS3Storage(options);
		case "local":
			return createLocalStorage(options);
		default:
			throw new Error(
				`Unknown STORAGE_PROVIDER: "${provider}". Supported: "local", "s3"`,
			);
	}
}

/**
 * Generate a unique storage key for a file upload.
 * Format: <prefix>/<year>/<month>/<randomId>-<sanitizedFilename>
 *
 * @param {string} originalFilename
 * @param {Object} [options]
 * @param {string} [options.prefix="uploads"] - Key prefix / folder
 * @returns {string}
 */
export function generateStorageKey(originalFilename, options = {}) {
	const prefix = options.prefix || "uploads";
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
	const safeName = originalFilename
		.replace(/[^a-zA-Z0-9._-]/g, "_")
		.replace(/_{2,}/g, "_")
		.toLowerCase();

	return `${prefix}/${year}/${month}/${id}-${safeName}`;
}

/**
 * Returns the public URL for a stored asset.
 *
 * Checks `ASSET_CDN_URL` first - if set, prepends it to the key.
 * This is provider-agnostic: works with any CDN (CloudFront, Cloudflare,
 * Bunny, Fastly, etc.) as long as the CDN is pointed at the same bucket.
 *
 * Falls back to the local API route (`/api/files/<key>`) when no CDN is
 * configured - covers local development and any environment where
 * `STORAGE_PROVIDER=local` is used.
 *
 * @param {string} key - Storage key (e.g. "uploads/2026/02/abc-photo.jpg")
 * @returns {string} Full CDN URL or local API route
 */
export function getAssetUrl(key) {
	const cdnBase = process.env.ASSET_CDN_URL;
	if (cdnBase) return `${cdnBase.replace(/\/$/, "")}/${key}`;
	return `/api/files/${encodeURIComponent(key)}`;
}

/**
 * @typedef {Object} StorageAdapter
 * @property {"local" | "s3"} provider
 * @property {(key: string, data: Buffer | Readable | string, meta?: { contentType?: string, cacheControl?: string }) => Promise<{ key: string, provider: string }>} put
 * @property {(key: string) => Promise<{ body: Buffer, contentType: string | null }>} get
 * @property {(key: string) => Promise<void>} delete
 * @property {(key: string) => Promise<boolean>} exists
 * @property {(key: string) => string} getPublicUrl
 * @property {(key: string, options?: { expiresIn?: number, contentType?: string }) => Promise<{ url: string, key: string, expiresAt: string }>} getSignedUploadUrl
 */
