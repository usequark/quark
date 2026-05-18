import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import { buildSitemapEntries } from "../lib/sitemap-entries.js";
import robots from "./robots.js";

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

	test("builds sitemap entries for static and public content routes", () => {
		const entries = buildSitemapEntries({
			appUrl: "https://example.com",
			publicContentEntries: [
				{
					path: "/about",
					changeFrequency: "weekly",
					priority: 0.8,
				},
			],
		});

		assert.strictEqual(entries[0].url, "https://example.com/");
		assert.strictEqual(entries[1].url, "https://example.com/about");
	});

	test("returns disallow-all robots in staging", () => {
		process.env.NODE_ENV = "staging";

		const config = robots();

		assert.strictEqual(config.rules.disallow, "/");
		assert.strictEqual(config.sitemap, undefined);
	});

	test("returns sitemap reference in production", () => {
		process.env.NODE_ENV = "production";
		process.env.ALLOW_INDEXING = "true";

		const config = robots();

		assert.strictEqual(config.sitemap, "https://example.com/sitemap.xml");
	});

	test("disallows protected routes in production", () => {
		process.env.NODE_ENV = "production";
		process.env.ALLOW_INDEXING = "true";

		const config = robots();

		assert.ok(Array.isArray(config.rules.disallow));
		assert.ok(config.rules.disallow.includes("/api/"));
		assert.ok(config.rules.disallow.includes("/admin/"));
		assert.ok(config.rules.disallow.includes("/auth/"));
	});
});
