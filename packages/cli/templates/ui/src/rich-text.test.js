import assert from "node:assert";
import { test } from "node:test";
import { RichText } from "./rich-text.js";

// RichText uses React hooks and contentEditable — full render tests require
// jsdom + react-dom. Here we verify the export contract only.

test("RichText - exports correctly", () => {
	assert(typeof RichText === "function");
});

test("RichText - has expected function name", () => {
	assert.strictEqual(RichText.name, "RichText");
});
