import assert from "node:assert";
import { test } from "node:test";
import { config } from "./index.js";

test("Config - has appName defined", () => {
	assert.strictEqual(config.appName, "Quark");
});

test("Config - has appDescription defined", () => {
	assert.strictEqual(typeof config.appDescription, "string");
	assert.ok(config.appDescription.length > 0);
});

test("Config - config object has expected shape", () => {
	assert(Object.hasOwn(config, "appName"));
	assert(Object.hasOwn(config, "appDescription"));
});
