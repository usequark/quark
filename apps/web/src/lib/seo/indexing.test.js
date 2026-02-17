import assert from "node:assert";
import { describe, test } from "node:test";
import { getMetadataRobots, isWebsiteIndexable } from "./indexing.js";

describe("SEO indexing based on NODE_ENV", () => {
	test("production NODE_ENV is indexable", () => {
		assert.strictEqual(isWebsiteIndexable({ NODE_ENV: "production" }), true);
	});

	test("non-production NODE_ENV is non-indexable", () => {
		assert.strictEqual(isWebsiteIndexable({ NODE_ENV: "staging" }), false);
		assert.strictEqual(isWebsiteIndexable({ NODE_ENV: "development" }), false);
		assert.strictEqual(isWebsiteIndexable({ NODE_ENV: "test" }), false);
	});

	test("returns index metadata in production", () => {
		const robots = getMetadataRobots({ NODE_ENV: "production" });

		assert.strictEqual(robots.index, true);
		assert.strictEqual(robots.follow, true);
	});

	test("returns noindex metadata in non-production", () => {
		const robots = getMetadataRobots({ NODE_ENV: "staging" });

		assert.strictEqual(robots.index, false);
		assert.strictEqual(robots.follow, false);
		assert.ok(robots.googleBot);
	});
});
