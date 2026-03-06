import assert from "node:assert";
import { test } from "node:test";
import { Input } from "./input.js";

test("Input - exports correctly", () => {
	assert(typeof Input === "function");
});

test("Input - renders with default props", () => {
	const result = Input({});
	assert.ok(result);
});

test("Input - accepts className override", () => {
	const result = Input({ className: "w-32", placeholder: "test" });
	assert.ok(result);
});

test("Input - accepts type prop", () => {
	const result = Input({ type: "email" });
	assert.ok(result);
});

test("Input - accepts disabled prop", () => {
	const result = Input({ disabled: true });
	assert.ok(result);
});
