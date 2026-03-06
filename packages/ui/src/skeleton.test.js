import assert from "node:assert";
import { test } from "node:test";
import { Skeleton } from "./skeleton.js";

test("Skeleton - exports correctly", () => {
	assert(typeof Skeleton === "function");
});

test("Skeleton - renders with default props", () => {
	const result = Skeleton({});
	assert.ok(result);
});

test("Skeleton - accepts className for dimensions", () => {
	const result = Skeleton({ className: "h-4 w-32" });
	assert.ok(result);
});

test("Skeleton - accepts aria props", () => {
	const result = Skeleton({ "aria-label": "Loading..." });
	assert.ok(result);
});
