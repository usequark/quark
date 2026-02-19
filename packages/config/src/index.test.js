import assert from "node:assert";
import { test } from "node:test";

test("Config - defaults appName to Quark when APP_NAME not set", async () => {
	const originalAppName = process.env.APP_NAME;
	delete process.env.APP_NAME;

	// Dynamic import to pick up fresh env
	const { config } = await import(`./index.js?t=${Date.now()}`);
	assert.strictEqual(config.appName, process.env.APP_NAME || "Quark");

	if (originalAppName !== undefined) process.env.APP_NAME = originalAppName;
});

test("Config - has appDescription defined", async () => {
	const { config } = await import(`./index.js?t=${Date.now()}a`);
	assert.strictEqual(typeof config.appDescription, "string");
	assert.ok(config.appDescription.length > 0);
});

test("Config - config object has expected shape", async () => {
	const { config } = await import(`./index.js?t=${Date.now()}b`);
	assert(Object.hasOwn(config, "appName"));
	assert(Object.hasOwn(config, "appDescription"));
});
