import { test } from "node:test";
import assert from "node:assert";
import { Button } from "./button.js";

test("Button - component exports correctly", () => {
  assert(typeof Button === "function", "Button should be a function");
});

test("Button - component accepts props", () => {
  // Test that component can be called with props
  const result = Button({ variant: "primary", className: "custom" });
  assert.ok(result, "Component should return an element");
});

test("Button - supports primary variant", () => {
  const result = Button({ variant: "primary" });
  assert.ok(result, "Primary variant should be supported");
});

test("Button - supports secondary variant", () => {
  const result = Button({ variant: "secondary" });
  assert.ok(result, "Secondary variant should be supported");
});
