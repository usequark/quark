import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { execa } from "execa";
import { findEnclosingGitRepo, formatProjectDisplayName } from "./utils.js";

// ---------------------------------------------------------------------------
// Happy path - common slug patterns
// ---------------------------------------------------------------------------

test("formatProjectDisplayName - hyphen-separated slug", () => {
	assert.strictEqual(formatProjectDisplayName("my-cool-app"), "My Cool App");
});

test("formatProjectDisplayName - underscore-separated slug", () => {
	assert.strictEqual(formatProjectDisplayName("my_app_v2"), "My App V2");
});

test("formatProjectDisplayName - dot-separated slug", () => {
	assert.strictEqual(formatProjectDisplayName("my.app"), "My App");
});

test("formatProjectDisplayName - single word (no separators)", () => {
	assert.strictEqual(formatProjectDisplayName("myapp"), "Myapp");
});

test("formatProjectDisplayName - already title-cased input", () => {
	// slice(1) preserves remaining chars as-is - only the first char is forced uppercase
	assert.strictEqual(formatProjectDisplayName("MyApp"), "MyApp");
});

test("formatProjectDisplayName - mixed separators", () => {
	assert.strictEqual(formatProjectDisplayName("my-app_v2.0"), "My App V2 0");
});

test("formatProjectDisplayName - consecutive separators collapse to single space", () => {
	assert.strictEqual(formatProjectDisplayName("my--app"), "My App");
	assert.strictEqual(formatProjectDisplayName("my___app"), "My App");
	assert.strictEqual(formatProjectDisplayName("my-._app"), "My App");
});

test("formatProjectDisplayName - numbers preserved in words", () => {
	assert.strictEqual(formatProjectDisplayName("app-v2"), "App V2");
	assert.strictEqual(formatProjectDisplayName("project-123"), "Project 123");
});

// ---------------------------------------------------------------------------
// Edge cases - degenerate / boundary inputs
// ---------------------------------------------------------------------------

test("formatProjectDisplayName - all separators returns fallback", () => {
	assert.strictEqual(formatProjectDisplayName("---"), "Quark App");
	assert.strictEqual(formatProjectDisplayName("___"), "Quark App");
	assert.strictEqual(formatProjectDisplayName("..."), "Quark App");
	assert.strictEqual(formatProjectDisplayName("-._-"), "Quark App");
});

test("formatProjectDisplayName - preserves casing of rest of word", () => {
	// The function only forces the first char uppercase; the remainder is untouched
	assert.strictEqual(formatProjectDisplayName("myApp"), "MyApp");
});

test("formatProjectDisplayName - short single-char name", () => {
	assert.strictEqual(formatProjectDisplayName("a"), "A");
});

// ---------------------------------------------------------------------------
// findEnclosingGitRepo
// ---------------------------------------------------------------------------

test("findEnclosingGitRepo - returns null outside a git work tree", async () => {
	const dir = await mkdtemp(path.join(os.tmpdir(), "quark-utils-"));
	try {
		assert.strictEqual(await findEnclosingGitRepo(dir), null);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("findEnclosingGitRepo - returns the repository root for any nested dir", async () => {
	const dir = await mkdtemp(path.join(os.tmpdir(), "quark-utils-"));
	try {
		await execa("git", ["init"], { cwd: dir });
		const nested = path.join(dir, "some", "nested", "dir");
		await mkdir(nested, { recursive: true });

		const expected = await realpath(dir);
		assert.strictEqual(await findEnclosingGitRepo(dir), expected);
		assert.strictEqual(await findEnclosingGitRepo(nested), expected);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
