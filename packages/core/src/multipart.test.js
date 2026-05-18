import assert from "node:assert";
import { test } from "node:test";
import { parseMultipart } from "../src/multipart.js";

// ---------------------------------------------------------------------------
// Helper: build a multipart/form-data body from parts
// ---------------------------------------------------------------------------

function buildMultipartBody(boundary, parts) {
	const lines = [];
	for (const part of parts) {
		lines.push(`--${boundary}`);
		if (part.filename) {
			lines.push(
				`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`,
			);
			lines.push(
				`Content-Type: ${part.contentType || "application/octet-stream"}`,
			);
		} else {
			lines.push(`Content-Disposition: form-data; name="${part.name}"`);
		}
		lines.push("");
		lines.push(part.value);
	}
	lines.push(`--${boundary}--`);
	return lines.join("\r\n");
}

function createMultipartRequest(parts, boundary = "----TestBoundary") {
	const body = buildMultipartBody(boundary, parts);
	return new Request("http://localhost/upload", {
		method: "POST",
		headers: {
			"content-type": `multipart/form-data; boundary=${boundary}`,
		},
		body,
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("Multipart - parses single file upload", async () => {
	const request = createMultipartRequest([
		{
			name: "file",
			filename: "test.txt",
			contentType: "text/plain",
			value: "hello world",
		},
	]);

	const result = await parseMultipart(request);
	assert.strictEqual(result.files.length, 1);
	assert.strictEqual(result.files[0].filename, "test.txt");
	assert.strictEqual(result.files[0].mimeType, "text/plain");
	assert.strictEqual(result.files[0].buffer.toString(), "hello world");
	assert.strictEqual(result.files[0].size, 11);
	assert.strictEqual(result.files[0].fieldName, "file");
});

test("Multipart - parses text fields", async () => {
	const request = createMultipartRequest([
		{ name: "title", value: "My Upload" },
		{ name: "description", value: "A test file" },
	]);

	const result = await parseMultipart(request);
	assert.strictEqual(result.files.length, 0);
	assert.strictEqual(result.fields.title, "My Upload");
	assert.strictEqual(result.fields.description, "A test file");
});

test("Multipart - parses mixed files and fields", async () => {
	const request = createMultipartRequest([
		{ name: "title", value: "Photo" },
		{
			name: "file",
			filename: "photo.jpg",
			contentType: "image/jpeg",
			value: "jpeg-data",
		},
	]);

	const result = await parseMultipart(request);
	assert.strictEqual(result.files.length, 1);
	assert.strictEqual(result.files[0].filename, "photo.jpg");
	assert.strictEqual(result.fields.title, "Photo");
});

test("Multipart - parses multiple files", async () => {
	const request = createMultipartRequest([
		{
			name: "files",
			filename: "a.txt",
			contentType: "text/plain",
			value: "aaa",
		},
		{
			name: "files",
			filename: "b.txt",
			contentType: "text/plain",
			value: "bbb",
		},
	]);

	const result = await parseMultipart(request);
	assert.strictEqual(result.files.length, 2);
	assert.strictEqual(result.files[0].filename, "a.txt");
	assert.strictEqual(result.files[1].filename, "b.txt");
});

test("Multipart - rejects non-multipart request", async () => {
	const request = new Request("http://localhost/upload", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: "{}",
	});

	await assert.rejects(
		() => parseMultipart(request),
		/not multipart\/form-data/,
	);
});

test("Multipart - rejects request with no body", async () => {
	const request = new Request("http://localhost/upload", {
		method: "POST",
		headers: {
			"content-type": "multipart/form-data; boundary=test",
		},
	});

	await assert.rejects(() => parseMultipart(request), /body is empty/);
});

test("Multipart - rejects file exceeding maxFileSize", async () => {
	const largeContent = "x".repeat(1024);
	const request = createMultipartRequest([
		{
			name: "file",
			filename: "big.txt",
			contentType: "text/plain",
			value: largeContent,
		},
	]);

	await assert.rejects(
		() => parseMultipart(request, { maxFileSize: 100 }),
		/exceeds maximum size/,
	);
});

test("Multipart - rejects request exceeding maxFiles", async () => {
	const request = createMultipartRequest([
		{
			name: "files",
			filename: "a.txt",
			contentType: "text/plain",
			value: "aaa",
		},
		{
			name: "files",
			filename: "b.txt",
			contentType: "text/plain",
			value: "bbb",
		},
	]);

	await assert.rejects(
		() => parseMultipart(request, { maxFiles: 1 }),
		/maximum file count/,
	);
});

test("Multipart - rejects request exceeding maxFields", async () => {
	const request = createMultipartRequest([
		{ name: "title", value: "My Upload" },
		{ name: "description", value: "A test file" },
	]);

	await assert.rejects(
		() => parseMultipart(request, { maxFields: 1 }),
		/maximum field count/,
	);
});
