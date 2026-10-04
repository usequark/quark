/**
 * @usequark/quark-core - S3 Storage Adapter
 *
 * Kept in its own module so `storage.js` (and the main barrel) never pull
 * the AWS SDK onto the import path: `@aws-sdk/client-s3` and
 * `@aws-sdk/s3-request-presigner` are optional peer dependencies and are
 * only loaded when an S3 adapter method is actually called. Apps running
 * `STORAGE_PROVIDER=local` do not need them installed.
 *
 * The dynamic imports are marked `webpackIgnore` so bundlers leave them as
 * runtime imports (resolved from the app's `node_modules`) instead of
 * trying to resolve them at build time. Apps that use S3 must install both
 * packages — the scaffolded web app already lists them as dependencies.
 */

const S3_CLIENT_PACKAGE = "@aws-sdk/client-s3";
const S3_PRESIGNER_PACKAGE = "@aws-sdk/s3-request-presigner";

function isMissingPackageError(error, packageName) {
	const message = error?.message ?? "";
	return (
		error?.code === "ERR_MODULE_NOT_FOUND" ||
		error?.code === "MODULE_NOT_FOUND" ||
		message.includes(`Cannot find package '${packageName}'`) ||
		message.includes(`Cannot find module '${packageName}'`)
	);
}

async function importS3ClientPackage() {
	try {
		return await import(/* webpackIgnore: true */ "@aws-sdk/client-s3");
	} catch (error) {
		if (isMissingPackageError(error, S3_CLIENT_PACKAGE)) {
			throw new Error(
				'S3 storage support requires installing "@aws-sdk/client-s3" in the app that uses @usequark/quark-core/storage/s3.',
			);
		}
		throw error;
	}
}

async function importS3PresignerPackage() {
	try {
		return await import(
			/* webpackIgnore: true */ "@aws-sdk/s3-request-presigner"
		);
	} catch (error) {
		if (isMissingPackageError(error, S3_PRESIGNER_PACKAGE)) {
			throw new Error(
				'Signed upload URLs require installing "@aws-sdk/s3-request-presigner" in the app that uses @usequark/quark-core/storage/s3.',
			);
		}
		throw error;
	}
}

// Cache the in-flight module promises so repeated adapter calls do not
// re-run the dynamic import (and a failed import keeps reporting the same
// friendly error).
let _s3ClientPackage = null;
let _s3PresignerPackage = null;

function loadS3ClientPackage() {
	_s3ClientPackage ??= importS3ClientPackage();
	return _s3ClientPackage;
}

function loadS3PresignerPackage() {
	_s3PresignerPackage ??= importS3PresignerPackage();
	return _s3PresignerPackage;
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
 * Requires `@aws-sdk/client-s3` (and `@aws-sdk/s3-request-presigner` for
 * `getSignedUploadUrl`) to be installed in the consuming app. Both are
 * loaded lazily on first use, so creating an adapter and reading its
 * `provider` / `getPublicUrl()` works without them.
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
		const { S3Client } = await loadS3ClientPackage();
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
			let body;
			if (Buffer.isBuffer(data) || typeof data === "string") {
				body = data;
			} else if (data && typeof data.pipe === "function") {
				const chunks = [];
				for await (const chunk of data) {
					chunks.push(chunk);
				}
				body = Buffer.concat(chunks);
			} else {
				throw new Error("put() expects a Buffer, string, or Readable stream");
			}

			const { PutObjectCommand } = await loadS3ClientPackage();
			const client = await getClient();
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
			const { GetObjectCommand } = await loadS3ClientPackage();
			const client = await getClient();
			const response = await client.send(
				new GetObjectCommand({ Bucket: bucket, Key: key }),
			);

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
			const { DeleteObjectCommand } = await loadS3ClientPackage();
			const client = await getClient();
			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
		},

		async exists(key) {
			const { HeadObjectCommand } = await loadS3ClientPackage();
			try {
				const client = await getClient();
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
			return `/api/files/${encodeURIComponent(key)}`;
		},

		/**
		 * Generate a pre-signed URL that allows a client (e.g. the browser) to
		 * upload directly to S3/R2 without routing the binary through the server.
		 *
		 * @param {string} key - Storage key for the object to be uploaded
		 * @param {Object} [options]
		 * @param {number} [options.expiresIn=300] - URL validity in seconds (default: 5 min)
		 * @param {string} [options.contentType] - Expected Content-Type; enforced by S3
		 * @returns {Promise<{ url: string, key: string, expiresAt: string }>}
		 */
		async getSignedUploadUrl(key, options = {}) {
			const expiresIn = options.expiresIn ?? 300;

			const { PutObjectCommand } = await loadS3ClientPackage();
			const { getSignedUrl } = await loadS3PresignerPackage();

			const command = new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				...(options.contentType ? { ContentType: options.contentType } : {}),
			});

			const client = await getClient();
			const url = await getSignedUrl(client, command, { expiresIn });
			const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

			return { url, key, expiresAt };
		},
	};
}
