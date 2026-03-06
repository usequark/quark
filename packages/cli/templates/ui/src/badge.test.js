import assert from "node:assert";
import { test } from "node:test";
import { Badge } from "./badge.js";

test("Badge - exports correctly", () => {
	assert(typeof Badge === "function");
});

test("Badge - renders with default props", () => {
	const result = Badge({});
	assert.ok(result);
});

test("Badge - supports default variant", () => {
	const result = Badge({ variant: "default" });
	assert.ok(result);
});

test("Badge - supports success variant", () => {
	const result = Badge({ variant: "success" });
	assert.ok(result);
});

test("Badge - supports warning variant", () => {
	const result = Badge({ variant: "warning" });
	assert.ok(result);
});

test("Badge - supports danger variant", () => {
	const result = Badge({ variant: "danger" });
	assert.ok(result);
});

test("Badge - supports info variant", () => {
	const result = Badge({ variant: "info" });
	assert.ok(result);
});

test("Badge - accepts className override", () => {
	const result = Badge({ className: "custom" });
	assert.ok(result);
});
