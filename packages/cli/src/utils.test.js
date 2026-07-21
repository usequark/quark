import assert from "node:assert/strict";
import { test } from "node:test";
import { formatProjectDisplayName } from "./utils.js";

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
