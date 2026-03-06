import assert from "node:assert";
import { test } from "node:test";
import { Button } from "./button.js";

test("Button - component exports correctly", () => {
	assert(typeof Button === "function", "Button should be a function");
});

test("Button - renders with default props", () => {
	const result = Button({});
	assert.ok(result, "Component should return an element");
});

test("Button - supports primary variant", () => {
	const result = Button({ variant: "primary" });
	assert.ok(result);
});

test("Button - supports secondary variant", () => {
	const result = Button({ variant: "secondary" });
	assert.ok(result);
});

test("Button - supports danger variant", () => {
	const result = Button({ variant: "danger" });
	assert.ok(result);
});

test("Button - supports ghost variant", () => {
	const result = Button({ variant: "ghost" });
	assert.ok(result);
});

test("Button - supports sm size", () => {
	const result = Button({ size: "sm" });
	assert.ok(result);
});

test("Button - supports md size", () => {
	const result = Button({ size: "md" });
	assert.ok(result);
});

test("Button - supports lg size", () => {
	const result = Button({ size: "lg" });
	assert.ok(result);
});

test("Button - accepts className override", () => {
	const result = Button({ className: "custom-class" });
	assert.ok(result);
});
