import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadPublishedResultWithFallback } from "./public-content-cache.js";

describe("stale-empty public content fallback", () => {
	test("rechecks uncached page content when cached lookup is empty", async () => {
		const freshPage = { slug: "about", title: "About" };
		let directCalls = 0;

		const result = await loadPublishedResultWithFallback("about", {
			loadCached: async (slug) => {
				assert.equal(slug, "about");
				return null;
			},
			loadDirect: async (slug) => {
				directCalls += 1;
				assert.equal(slug, "about");
				return freshPage;
			},
		});

		assert.deepEqual(result, freshPage);
		assert.equal(directCalls, 1);
	});

	test("rechecks uncached slug lists when cached results are empty", async () => {
		const freshRecords = [{ slug: "launch-week" }];
		let directCalls = 0;

		const result = await loadPublishedResultWithFallback("Post", {
			loadCached: async (model) => {
				assert.equal(model, "Post");
				return [];
			},
			loadDirect: async (model) => {
				directCalls += 1;
				assert.equal(model, "Post");
				return freshRecords;
			},
		});

		assert.deepEqual(result, freshRecords);
		assert.equal(directCalls, 1);
	});

	test("keeps populated cached results without an uncached read", async () => {
		const cachedRecords = [{ slug: "cached" }];
		let directCalls = 0;

		const result = await loadPublishedResultWithFallback("Page", {
			loadCached: async () => cachedRecords,
			loadDirect: async () => {
				directCalls += 1;
				return [{ slug: "fresh" }];
			},
		});

		assert.strictEqual(result, cachedRecords);
		assert.equal(directCalls, 0);
	});
});
