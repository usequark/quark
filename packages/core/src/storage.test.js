import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import {
	createLocalStorage,
	createStorage,
	generateStorageKey,
	getAssetUrl,
} from "../src/storage.js";

// ---------------------------------------------------------------------------
// generateStorageKey
// ---------------------------------------------------------------------------

test("Storage - generateStorageKey returns path with prefix/year/month/sanitized name", () => {
	const key = generateStorageKey("my Photo (1).png");
	const parts = key.split("/");
	assert.strictEqual(parts[0], "uploads");
	assert.match(parts[1], /^\d{4}$/); // year
	assert.match(parts[2], /^\d{2}$/); // month
	assert.match(parts[3], /^[a-f0-9]{16}-my_photo_1_.png$/);
});

test("Storage - generateStorageKey accepts a custom prefix", () => {
	const key = generateStorageKey("file.txt", { prefix: "avatars" });
	assert(key.startsWith("avatars/"));
});

test("Storage - generateStorageKey sanitizes special characters", () => {
	const key = generateStorageKey("../../../etc/passwd");
	// Dots and slashes are replaced with underscores; the key stays under the prefix
	assert(key.startsWith("uploads/"));
	assert(key.includes("etc_passwd"));
});

test("Storage - generateStorageKey produces unique keys", () => {
	const a = generateStorageKey("a.jpg");
	const b = generateStorageKey("a.jpg");
	assert.notStrictEqual(a, b);
});

// ---------------------------------------------------------------------------
// createLocalStorage
// ---------------------------------------------------------------------------

test("Storage - createLocalStorage put/get round-trip with Buffer", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		const data = Buffer.from("hello world");
		await storage.put("test/file.txt", data);

		const result = await storage.get("test/file.txt");
		assert.deepStrictEqual(result.body, data);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage put with string data", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await storage.put("test/string.txt", "string content");

		const result = await storage.get("test/string.txt");
		assert.strictEqual(result.body.toString(), "string content");
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage put with Readable stream", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		const stream = Readable.from(["stream ", "content"]);
		await storage.put("test/stream.txt", stream);

		const result = await storage.get("test/stream.txt");
		assert.strictEqual(result.body.toString(), "stream content");
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage put rejects invalid data", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await assert.rejects(
			() => storage.put("test/bad", 123),
			/Buffer, string, or Readable/,
		);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage exists returns true for existing file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await storage.put("exists.txt", "yes");
		assert.strictEqual(await storage.exists("exists.txt"), true);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage exists returns false for missing file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		assert.strictEqual(await storage.exists("nope.txt"), false);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage delete removes file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await storage.put("del.txt", "bye");
		assert.strictEqual(await storage.exists("del.txt"), true);
		await storage.delete("del.txt");
		assert.strictEqual(await storage.exists("del.txt"), false);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage delete is idempotent (non-existent file)", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await storage.delete("not-there.txt"); // should not throw
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - createLocalStorage getPublicUrl returns API path", () => {
	const storage = createLocalStorage();
	const url = storage.getPublicUrl("uploads/2025/01/abc-file.png");
	assert(url.startsWith("/api/files/"));
});

test("Storage - createLocalStorage provider is 'local'", () => {
	const storage = createLocalStorage();
	assert.strictEqual(storage.provider, "local");
});

// ---------------------------------------------------------------------------
// Path traversal protection
// ---------------------------------------------------------------------------

test("Storage - put rejects path traversal via ../", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await assert.rejects(
			() => storage.put("../../etc/passwd", "evil"),
			/Path traversal detected/,
		);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - get rejects path traversal via ../", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await assert.rejects(
			() => storage.get("../../../etc/shadow"),
			/Path traversal detected/,
		);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - delete rejects path traversal via ../", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await assert.rejects(
			() => storage.delete("../../etc/hosts"),
			/Path traversal detected/,
		);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - exists rejects path traversal via ../", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await assert.rejects(
			() => storage.exists("../../etc/passwd"),
			/Path traversal detected/,
		);
	} finally {
		await rm(dir, { recursive: true });
	}
});

test("Storage - allows nested subdirectories within baseDir", async () => {
	const dir = await mkdtemp(join(tmpdir(), "storage-"));
	try {
		const storage = createLocalStorage({ directory: dir });
		await storage.put("uploads/2026/02/file.txt", "safe");
		const result = await storage.get("uploads/2026/02/file.txt");
		assert.strictEqual(result.body.toString(), "safe");
	} finally {
		await rm(dir, { recursive: true });
	}
});

// ---------------------------------------------------------------------------
// createStorage factory
// ---------------------------------------------------------------------------

test("Storage - createStorage defaults to local", () => {
	const storage = createStorage();
	assert.strictEqual(storage.provider, "local");
});

test("Storage - createStorage with explicit provider 'local'", () => {
	const storage = createStorage({ provider: "local" });
	assert.strictEqual(storage.provider, "local");
});

test("Storage - createStorage throws for unknown provider", () => {
	assert.throws(
		() => createStorage({ provider: "azure" }),
		/Unknown STORAGE_PROVIDER/,
	);
});

test("Storage - createStorage with 's3' provider requires bucket", () => {
	assert.throws(
		() =>
			createStorage({ provider: "s3", accessKeyId: "x", secretAccessKey: "y" }),
		/S3_BUCKET is required/,
	);
});

test("Storage - createStorage with 's3' provider requires credentials", () => {
	assert.throws(
		() => createStorage({ provider: "s3", bucket: "b" }),
		/S3_ACCESS_KEY_ID is required/,
	);
});

// ---------------------------------------------------------------------------
// createS3Storage (unit tests without real S3 — validate init)
// ---------------------------------------------------------------------------

test("Storage - createS3Storage sets provider to 's3'", () => {
	const storage = createStorage({
		provider: "s3",
		bucket: "test-bucket",
		accessKeyId: "key",
		secretAccessKey: "secret",
	});
	assert.strictEqual(storage.provider, "s3");
});

test("Storage - createS3Storage getPublicUrl with publicUrl option", () => {
	const storage = createStorage({
		provider: "s3",
		bucket: "test-bucket",
		accessKeyId: "key",
		secretAccessKey: "secret",
		publicUrl: "https://cdn.example.com/",
	});
	assert.strictEqual(
		storage.getPublicUrl("uploads/file.png"),
		"https://cdn.example.com/uploads/file.png",
	);
});

test("Storage - createS3Storage getPublicUrl without publicUrl falls back to API", () => {
	const storage = createStorage({
		provider: "s3",
		bucket: "test-bucket",
		accessKeyId: "key",
		secretAccessKey: "secret",
	});
	const url = storage.getPublicUrl("uploads/file.png");
	assert(url.startsWith("/api/files/"));
});

// ---------------------------------------------------------------------------
// getAssetUrl
// ---------------------------------------------------------------------------

test("getAssetUrl - returns CDN URL when ASSET_CDN_URL is set", () => {
	process.env.ASSET_CDN_URL = "https://assets.example.com";
	try {
		const url = getAssetUrl("uploads/2026/02/abc-photo.jpg");
		assert.strictEqual(
			url,
			"https://assets.example.com/uploads/2026/02/abc-photo.jpg",
		);
	} finally {
		delete process.env.ASSET_CDN_URL;
	}
});

test("getAssetUrl - strips trailing slash from ASSET_CDN_URL", () => {
	process.env.ASSET_CDN_URL = "https://assets.example.com/";
	try {
		const url = getAssetUrl("uploads/file.png");
		assert.strictEqual(url, "https://assets.example.com/uploads/file.png");
	} finally {
		delete process.env.ASSET_CDN_URL;
	}
});

test("getAssetUrl - falls back to /api/files when ASSET_CDN_URL is not set", () => {
	delete process.env.ASSET_CDN_URL;
	const url = getAssetUrl("uploads/2026/02/abc-photo.jpg");
	assert.strictEqual(url, "/api/files/uploads%2F2026%2F02%2Fabc-photo.jpg");
});

test("getAssetUrl - percent-encodes key in fallback URL", () => {
	delete process.env.ASSET_CDN_URL;
	const url = getAssetUrl("uploads/file with spaces.jpg");
	assert.strictEqual(url, "/api/files/uploads%2Ffile%20with%20spaces.jpg");
});

// ---------------------------------------------------------------------------
// getSignedUploadUrl
// ---------------------------------------------------------------------------

test("getSignedUploadUrl - local adapter throws a clear error", async () => {
	const storage = createLocalStorage();
	await assert.rejects(
		() => storage.getSignedUploadUrl("uploads/file.png"),
		/getSignedUploadUrl\(\) requires STORAGE_PROVIDER=s3/,
	);
});

test("getSignedUploadUrl - local adapter error message mentions POST /api/files", async () => {
	const storage = createLocalStorage();
	await assert.rejects(
		() => storage.getSignedUploadUrl("uploads/file.png"),
		/POST \/api\/files/,
	);
});

test("getSignedUploadUrl - S3 adapter exposes the method as a function", () => {
	const storage = createStorage({
		provider: "s3",
		bucket: "test-bucket",
		accessKeyId: "key",
		secretAccessKey: "secret",
	});
	assert.strictEqual(typeof storage.getSignedUploadUrl, "function");
});
