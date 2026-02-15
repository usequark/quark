import assert from "node:assert";
import { test } from "node:test";
import {
	detectMimeType,
	isTypeAllowed,
	validateFile,
} from "../src/file-validation.js";

// ---------------------------------------------------------------------------
// detectMimeType
// ---------------------------------------------------------------------------

test("FileValidation - detectMimeType identifies JPEG", () => {
	const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
	assert.strictEqual(detectMimeType(buf), "image/jpeg");
});

test("FileValidation - detectMimeType identifies PNG", () => {
	const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	assert.strictEqual(detectMimeType(buf), "image/png");
});

test("FileValidation - detectMimeType identifies GIF", () => {
	const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
	assert.strictEqual(detectMimeType(buf), "image/gif");
});

test("FileValidation - detectMimeType identifies WebP", () => {
	const buf = Buffer.alloc(16);
	// RIFF....WEBP
	buf.writeUInt8(0x52, 0); // R
	buf.writeUInt8(0x49, 1); // I
	buf.writeUInt8(0x46, 2); // F
	buf.writeUInt8(0x46, 3); // F
	buf.writeUInt8(0x57, 8); // W
	buf.writeUInt8(0x45, 9); // E
	buf.writeUInt8(0x42, 10); // B
	buf.writeUInt8(0x50, 11); // P
	assert.strictEqual(detectMimeType(buf), "image/webp");
});

test("FileValidation - detectMimeType identifies PDF", () => {
	const buf = Buffer.from("%PDF-1.5", "ascii");
	assert.strictEqual(detectMimeType(buf), "application/pdf");
});

test("FileValidation - detectMimeType identifies SVG", () => {
	const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
	assert.strictEqual(detectMimeType(buf), "image/svg+xml");
});

test("FileValidation - detectMimeType identifies SVG with XML declaration", () => {
	const buf = Buffer.from('<?xml version="1.0"?><svg></svg>');
	assert.strictEqual(detectMimeType(buf), "image/svg+xml");
});

test("FileValidation - detectMimeType identifies ZIP", () => {
	const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
	assert.strictEqual(detectMimeType(buf), "application/zip");
});

test("FileValidation - detectMimeType identifies WebM", () => {
	const buf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]);
	assert.strictEqual(detectMimeType(buf), "video/webm");
});

test("FileValidation - detectMimeType returns null for unknown bytes", () => {
	const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
	assert.strictEqual(detectMimeType(buf), null);
});

// ---------------------------------------------------------------------------
// isTypeAllowed
// ---------------------------------------------------------------------------

test("FileValidation - isTypeAllowed exact match", () => {
	assert.strictEqual(
		isTypeAllowed("image/jpeg", ["image/jpeg", "image/png"]),
		true,
	);
	assert.strictEqual(
		isTypeAllowed("image/gif", ["image/jpeg", "image/png"]),
		false,
	);
});

test("FileValidation - isTypeAllowed wildcard category match", () => {
	assert.strictEqual(isTypeAllowed("image/jpeg", ["image/*"]), true);
	assert.strictEqual(isTypeAllowed("image/png", ["image/*"]), true);
	assert.strictEqual(isTypeAllowed("application/pdf", ["image/*"]), false);
});

test("FileValidation - isTypeAllowed universal wildcard", () => {
	assert.strictEqual(isTypeAllowed("video/mp4", ["*/*"]), true);
});

test("FileValidation - isTypeAllowed is case insensitive", () => {
	assert.strictEqual(isTypeAllowed("Image/JPEG", ["image/jpeg"]), true);
});

test("FileValidation - isTypeAllowed returns false for null/empty mime", () => {
	assert.strictEqual(isTypeAllowed(null, ["image/jpeg"]), false);
	assert.strictEqual(isTypeAllowed("", ["image/jpeg"]), false);
});

// ---------------------------------------------------------------------------
// validateFile
// ---------------------------------------------------------------------------

test("FileValidation - validateFile accepts valid file", () => {
	const pngMagic = Buffer.from([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	]);
	const result = validateFile(
		{
			filename: "test.png",
			mimeType: "image/png",
			size: 1024,
			buffer: pngMagic,
		},
		{ allowedTypes: ["image/*"] },
	);
	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.detectedType, "image/png");
});

test("FileValidation - validateFile rejects oversized file", () => {
	const result = validateFile(
		{ filename: "big.jpg", mimeType: "image/jpeg", size: 20 * 1024 * 1024 },
		{ maxSize: 10 * 1024 * 1024 },
	);
	assert.strictEqual(result.valid, false);
	assert.match(result.error, /exceeds maximum size/);
});

test("FileValidation - validateFile rejects disallowed MIME type", () => {
	const result = validateFile(
		{ filename: "virus.exe", mimeType: "application/x-msdownload", size: 100 },
		{ allowedTypes: ["image/*"] },
	);
	assert.strictEqual(result.valid, false);
	assert.match(result.error, /not allowed/);
});

test("FileValidation - validateFile detects MIME spoofing", () => {
	// Claim it's an image/jpeg but magic bytes say PDF
	const pdfMagic = Buffer.from("%PDF-1.5", "ascii");
	const result = validateFile(
		{
			filename: "fake.jpg",
			mimeType: "image/jpeg",
			size: 100,
			buffer: pdfMagic,
		},
		{ allowedTypes: ["image/jpeg", "application/pdf"] },
	);
	assert.strictEqual(result.valid, false);
	assert.match(result.error, /does not match declared type/);
	assert.strictEqual(result.detectedType, "application/pdf");
});

test("FileValidation - validateFile skips magic bytes when disabled", () => {
	const pdfMagic = Buffer.from("%PDF-1.5", "ascii");
	const result = validateFile(
		{
			filename: "file.jpg",
			mimeType: "image/jpeg",
			size: 100,
			buffer: pdfMagic,
		},
		{ allowedTypes: ["image/jpeg"], verifyMagicBytes: false },
	);
	assert.strictEqual(result.valid, true);
});

test("FileValidation - validateFile passes when magic bytes unknown", () => {
	// Unknown magic bytes should not block the file
	const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
	const result = validateFile(
		{
			filename: "data.bin",
			mimeType: "application/pdf",
			size: 100,
			buffer: buf,
		},
		{ allowedTypes: ["application/pdf"] },
	);
	assert.strictEqual(result.valid, true);
});

test("FileValidation - validateFile works without buffer", () => {
	const result = validateFile(
		{ filename: "file.png", mimeType: "image/png", size: 100 },
		{ allowedTypes: ["image/*"] },
	);
	assert.strictEqual(result.valid, true);
});

test("FileValidation - validateFile uses env defaults gracefully", () => {
	// No options → uses module defaults
	const result = validateFile({
		filename: "test.jpg",
		mimeType: "image/jpeg",
		size: 1024,
	});
	assert.strictEqual(result.valid, true);
});
