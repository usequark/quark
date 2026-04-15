import assert from "node:assert";
import { describe, test } from "node:test";
import { getMetadataRobots, isWebsiteIndexable } from "./indexing.js";

describe("SEO indexing based on ALLOW_INDEXING", () => {
	test("ALLOW_INDEXING=true is indexable", () => {
		assert.strictEqual(isWebsiteIndexable({ ALLOW_INDEXING: "true" }), true);
	});

	test("ALLOW_INDEXING absent is non-indexable", () => {
		assert.strictEqual(isWebsiteIndexable({}), false);
	});

	test("ALLOW_INDEXING=false is non-indexable", () => {
		assert.strictEqual(isWebsiteIndexable({ ALLOW_INDEXING: "false" }), false);
	});

	test("NODE_ENV=production alone is non-indexable", () => {
		assert.strictEqual(isWebsiteIndexable({ NODE_ENV: "production" }), false);
	});

	test("returns index metadata when ALLOW_INDEXING=true", () => {
		const robots = getMetadataRobots({ ALLOW_INDEXING: "true" });

		assert.strictEqual(robots.index, true);
		assert.strictEqual(robots.follow, true);
	});

	test("returns noindex metadata when ALLOW_INDEXING is absent", () => {
		const robots = getMetadataRobots({});

		assert.strictEqual(robots.index, false);
		assert.strictEqual(robots.follow, false);
		assert.ok(robots.googleBot);
	});
});
