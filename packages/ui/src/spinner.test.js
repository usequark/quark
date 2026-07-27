import assert from "node:assert";
import { test } from "node:test";
import { Spinner } from "./spinner.js";

test("Spinner - exports correctly", () => {
	assert(typeof Spinner === "function");
});

test("Spinner - renders with default props", () => {
	const result = Spinner({});
	assert.ok(result);
});

test("Spinner - accepts custom className", () => {
	const result = Spinner({ className: "h-8 w-8" });
	assert.ok(result);
});

test("Spinner - accepts custom aria label", () => {
	const result = Spinner({ label: "Saving..." });
	assert.ok(result);
});
