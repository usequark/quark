import assert from "node:assert";
import { test } from "node:test";
import { Select } from "./select.js";

test("Select - exports correctly", () => {
	assert(typeof Select === "function");
});

test("Select - renders with default props", () => {
	const result = Select({});
	assert.ok(result);
});

test("Select - accepts className override", () => {
	const result = Select({ className: "w-48" });
	assert.ok(result);
});

test("Select - accepts children", () => {
	const result = Select({ children: null });
	assert.ok(result);
});

test("Select - accepts disabled prop", () => {
	const result = Select({ disabled: true });
	assert.ok(result);
});
