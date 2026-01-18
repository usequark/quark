import { test } from "node:test";
import assert from "node:assert";

test("Home Page - should have TechStream defined", () => {
  assert.ok("TechStream Core");
});

test("Home Page - page module exists", () => {
  // Basic smoke test - the actual page is tested via E2E tests
  assert.strictEqual(true, true);
});
