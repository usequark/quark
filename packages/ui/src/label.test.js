import assert from "node:assert";
import { test } from "node:test";
import { Label } from "./label.js";

test("Label - exports correctly", () => {
	assert(typeof Label === "function");
});

test("Label - renders with default props", () => {
	const result = Label({});
	assert.ok(result);
});

test("Label - accepts className override", () => {
	const result = Label({ className: "custom" });
	assert.ok(result);
});

test("Label - accepts htmlFor prop", () => {
	const result = Label({ htmlFor: "my-input", children: "My label" });
	assert.ok(result);
});
