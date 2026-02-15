/**
 * @techstream/quark-core - File Storage
 *
 * Adapter-based storage abstraction supporting local filesystem and
 * S3-compatible providers (AWS S3, Cloudflare R2, MinIO, etc.).
 *
 * Usage:
 *   const storage = createStorage();  // reads STORAGE_PROVIDER env
 *   await storage.put(key, buffer, { contentType: "image/png" });
 *   const { body, contentType } = await storage.get(key);
 *   await storage.delete(key);
 */

import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

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
			const filePath = join(baseDir, key);
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
			const filePath = join(baseDir, key);
			const buffer = await readFile(filePath);
			return { body: buffer, contentType: null };
		},

		async delete(key) {
			const filePath = join(baseDir, key);
			try {
				await unlink(filePath);
			} catch (err) {
				if (err.code !== "ENOENT") throw err;
			}
		},

		async exists(key) {
			try {
				await stat(join(baseDir, key));
				return true;
			} catch {
				return false;
			}
		},

		getPublicUrl(key) {
			// Local files are served via the API route, not a public URL
			return `/api/files/${encodeURIComponent(key)}`;
		},
	};
}

// ---------------------------------------------------------------------------
// S3-Compatible Storage Adapter (AWS S3 / Cloudflare R2 / MinIO)
// ---------------------------------------------------------------------------

/**
 * Creates an S3-compatible storage adapter.
 * Works with AWS S3, Cloudflare R2, MinIO, and any S3-compatible service.
 *
 * Required env vars (or pass via options):
 *   S3_BUCKET           - Bucket name
 *   S3_REGION           - Region (use "auto" for R2)
 *   S3_ACCESS_KEY_ID    - Access key
 *   S3_SECRET_ACCESS_KEY - Secret key
 *   S3_ENDPOINT         - Custom endpoint (required for R2/MinIO)
 *   S3_PUBLIC_URL       - Optional public URL prefix for signed/public URLs
 *
 * For Cloudflare R2:
 *   S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
 *   S3_REGION=auto
 *
 * @param {Object} options
 * @returns {StorageAdapter}
 */
export function createS3Storage(options = {}) {
	const bucket = options.bucket || process.env.S3_BUCKET;
	const region = options.region || process.env.S3_REGION || "auto";
	const endpoint = options.endpoint || process.env.S3_ENDPOINT;
	const accessKeyId = options.accessKeyId || process.env.S3_ACCESS_KEY_ID;
	const secretAccessKey =
		options.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY;
	const publicUrl = options.publicUrl || process.env.S3_PUBLIC_URL;

	if (!bucket) throw new Error("S3_BUCKET is required for S3 storage");
	if (!accessKeyId)
		throw new Error("S3_ACCESS_KEY_ID is required for S3 storage");
	if (!secretAccessKey)
		throw new Error("S3_SECRET_ACCESS_KEY is required for S3 storage");

	/** @type {import("@aws-sdk/client-s3").S3Client | null} */
	let _client = null;

	async function getClient() {
		if (_client) return _client;
		const { S3Client } = await import("@aws-sdk/client-s3");
		_client = new S3Client({
			region,
			credentials: { accessKeyId, secretAccessKey },
			...(endpoint ? { endpoint, forcePathStyle: true } : {}),
		});
		return _client;
	}

	return {
		provider: "s3",

		async put(key, data, meta = {}) {
			const { PutObjectCommand } = await import("@aws-sdk/client-s3");
			const client = await getClient();

			let body;
			if (Buffer.isBuffer(data) || typeof data === "string") {
				body = data;
			} else if (data && typeof data.pipe === "function") {
				// Convert stream to buffer for S3 (SDK needs content-length)
				const chunks = [];
				for await (const chunk of data) {
					chunks.push(chunk);
				}
				body = Buffer.concat(chunks);
			} else {
				throw new Error("put() expects a Buffer, string, or Readable stream");
			}

			await client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: body,
					ContentType: meta.contentType || "application/octet-stream",
					...(meta.cacheControl ? { CacheControl: meta.cacheControl } : {}),
				}),
			);

			return { key, provider: "s3" };
		},

		async get(key) {
			const { GetObjectCommand } = await import("@aws-sdk/client-s3");
			const client = await getClient();

			const response = await client.send(
				new GetObjectCommand({ Bucket: bucket, Key: key }),
			);

			// Convert the readable stream to a Buffer
			const chunks = [];
			for await (const chunk of response.Body) {
				chunks.push(chunk);
			}

			return {
				body: Buffer.concat(chunks),
				contentType: response.ContentType || null,
			};
		},

		async delete(key) {
			const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
			const client = await getClient();

			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
		},

		async exists(key) {
			const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
			const client = await getClient();

			try {
				await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
				return true;
			} catch (err) {
				if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
					return false;
				}
				throw err;
			}
		},

		getPublicUrl(key) {
			if (publicUrl) {
				return `${publicUrl.replace(/\/$/, "")}/${key}`;
			}
			// Fall back to API route
			return `/api/files/${encodeURIComponent(key)}`;
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
 * @typedef {Object} StorageAdapter
 * @property {"local" | "s3"} provider
 * @property {(key: string, data: Buffer | Readable | string, meta?: { contentType?: string, cacheControl?: string }) => Promise<{ key: string, provider: string }>} put
 * @property {(key: string) => Promise<{ body: Buffer, contentType: string | null }>} get
 * @property {(key: string) => Promise<void>} delete
 * @property {(key: string) => Promise<boolean>} exists
 * @property {(key: string) => string} getPublicUrl
 */
