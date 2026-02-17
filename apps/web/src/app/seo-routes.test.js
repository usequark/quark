import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import robots from "./robots.js";
import sitemap from "./sitemap.js";

describe("SEO generators", () => {
	let savedEnv;

	beforeEach(() => {
		savedEnv = { ...process.env };
		process.env.APP_URL = "https://example.com";
	});

	afterEach(() => {
		for (const key of Object.keys(process.env)) {
			if (!(key in savedEnv)) {
				delete process.env[key];
			}
		}

		for (const [key, value] of Object.entries(savedEnv)) {
			process.env[key] = value;
		}
	});

	test("generates sitemap entries in production", () => {
		process.env.NODE_ENV = "production";

		const entries = sitemap();

		assert.ok(entries.length > 0);
		assert.strictEqual(entries[0].url, "https://example.com/");
	});

	test("returns empty sitemap in non-production", () => {
		process.env.NODE_ENV = "staging";

		const entries = sitemap();

		assert.deepStrictEqual(entries, []);
	});

	test("returns disallow-all robots in staging", () => {
		process.env.NODE_ENV = "staging";

		const config = robots();

		assert.strictEqual(config.rules.disallow, "/");
		assert.strictEqual(config.sitemap, undefined);
	});

	test("returns sitemap reference in production", () => {
		process.env.NODE_ENV = "production";

		const config = robots();

		assert.strictEqual(config.sitemap, "https://example.com/sitemap.xml");
	});
});
