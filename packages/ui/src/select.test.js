import assert from "node:assert";
import { test } from "node:test";
import { Select } from "./select.js";

// Select now uses React hooks and is rendered in the browser/client runtime.
// Unit tests here validate module contract only.

test("Select - exports correctly", () => {
	assert(typeof Select === "function");
});

test("Select - has expected function name", () => {
	assert.strictEqual(Select.name, "Select");
});
