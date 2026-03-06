import assert from "node:assert";
import { test } from "node:test";
import { Toast, useToast } from "./toast.js";

// Toast uses React hooks (useState, useEffect, useRef) and must be rendered
// via a React renderer. Direct invocation in node --test is not supported.
// Tests here verify the module exports correct types only.

test("Toast - exports correctly", () => {
	assert.strictEqual(typeof Toast, "function");
});

test("Toast - has expected function name", () => {
	assert.strictEqual(Toast.name, "Toast");
});

test("useToast - exports correctly", () => {
	assert.strictEqual(typeof useToast, "function");
});

test("useToast - has expected function name", () => {
	assert.strictEqual(useToast.name, "useToast");
});
