import assert from "node:assert";
import { test } from "node:test";
import { FormField } from "./form-field.js";

// FormField is a client component that uses React hooks (useId) and requires
// a React renderer to execute. Full render tests belong in an integration test
// suite with jsdom + react-dom. Here we verify the export contract only.

test("FormField - exports correctly", () => {
	assert(typeof FormField === "function");
});

test("FormField - has expected function name", () => {
	assert.strictEqual(FormField.name, "FormField");
});
