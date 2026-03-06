import assert from "node:assert";
import { test } from "node:test";
import { Textarea } from "./textarea.js";

test("Textarea - exports correctly", () => {
	assert(typeof Textarea === "function");
});

test("Textarea - renders with default props", () => {
	const result = Textarea({});
	assert.ok(result);
});

test("Textarea - accepts className override", () => {
	const result = Textarea({ className: "h-32" });
	assert.ok(result);
});

test("Textarea - accepts rows prop", () => {
	const result = Textarea({ rows: 4, placeholder: "Enter text..." });
	assert.ok(result);
});

test("Textarea - accepts disabled prop", () => {
	const result = Textarea({ disabled: true });
	assert.ok(result);
});
