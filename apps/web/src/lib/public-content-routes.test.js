import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	getPublicContentPath,
	isReservedPublicSlug,
	normalizePublicContentRoutes,
	RESERVED_ROOT_PUBLIC_SLUGS,
} from "./public-content-routes.js";

describe("public content route normalization", () => {
	test("defaults Page to the root slug route", () => {
		const routes = normalizePublicContentRoutes(null);

		assert.deepStrictEqual(routes, [
			{
				model: "Page",
				pathPrefix: "",
				routePattern: "/[slug]",
				reservedSlugs: [...RESERVED_ROOT_PUBLIC_SLUGS],
				sitemap: {
					changeFrequency: "weekly",
					priority: 0.8,
				},
			},
		]);
	});

	test("includes richer routes declared in cms config", () => {
		const routes = normalizePublicContentRoutes({
			contentTypes: {
				Page: {
					label: "Pages",
					publicRoute: { pathPrefix: "" },
				},
				Post: {
					label: "Posts",
					publicRoute: {
						pathPrefix: "blog",
						sitemap: {
							changeFrequency: "daily",
							priority: 0.6,
						},
					},
				},
			},
		});

		assert.equal(routes.length, 2);
		assert.equal(routes[0].model, "Page");
		assert.equal(routes[1].model, "Post");
		assert.equal(routes[1].routePattern, "/blog/[slug]");
		assert.equal(routes[1].sitemap.changeFrequency, "daily");
		assert.equal(routes[1].sitemap.priority, 0.6);
	});

	test("builds concrete paths and respects reserved slugs", () => {
		const [pageRoute, postRoute] = normalizePublicContentRoutes({
			contentTypes: {
				Page: {
					label: "Pages",
					publicRoute: { pathPrefix: "" },
				},
				Post: {
					label: "Posts",
					publicRoute: { pathPrefix: "blog" },
				},
			},
		});

		assert.equal(getPublicContentPath(pageRoute, "about"), "/about");
		assert.equal(
			getPublicContentPath(postRoute, "release-notes"),
			"/blog/release-notes",
		);
		assert.equal(isReservedPublicSlug(pageRoute, "admin"), true);
		assert.equal(isReservedPublicSlug(postRoute, "admin"), false);
	});
});
