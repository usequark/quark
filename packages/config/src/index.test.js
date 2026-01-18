import { test } from "node:test";
import assert from "node:assert";
import { config } from "./index.js";

test("Config - has appName defined", () => {
  assert.strictEqual(config.appName, "TechStream");
});

test("Config - config object has expected shape", () => {
  assert(Object.prototype.hasOwnProperty.call(config, "appName"));
});
