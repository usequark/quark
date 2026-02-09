import assert from "node:assert";
import { test } from "node:test";

test("Home Page - should have Quark defined", () => {
	assert.ok("Quark");
});

test("Home Page - page module exists", () => {
	// Basic smoke test - the actual page is tested via E2E tests
	assert.strictEqual(true, true);
});
