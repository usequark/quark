import assert from "node:assert";
import { test } from "node:test";
import { config } from "./index.js";

test("Config - has appName defined", () => {
	assert.strictEqual(config.appName, "Quark");
});

test("Config - config object has expected shape", () => {
	assert(Object.hasOwn(config, "appName"));
});
