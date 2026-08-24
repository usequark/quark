import assert from "node:assert";
import { test } from "node:test";

import { getPageMetadata } from "./site-metadata.js";

test("getPageMetadata appends the brand suffix exactly once", () => {
	const meta = getPageMetadata({ title: "Emergency Plumber" });
	assert.strictEqual(meta.title.absolute, "Emergency Plumber | Quark");
});

test("getPageMetadata falls back to the app description", () => {
	const meta = getPageMetadata({ title: "About Us" });
	assert.ok(meta.description.length > 0);
	assert.strictEqual(meta.openGraph.description, meta.description);
	assert.strictEqual(meta.twitter.title, "About Us");
});

test("getPageMetadata sets canonical and og url from path", () => {
	const meta = getPageMetadata({ title: "Services", path: "/services" });
	assert.deepStrictEqual(meta.alternates, { canonical: "/services" });
	assert.ok(meta.openGraph.url.endsWith("/services"));
});

test("getPageMetadata honors noIndex", () => {
	const meta = getPageMetadata({ title: "Hidden", noIndex: true });
	assert.deepStrictEqual(meta.robots, { index: false, follow: false });
});
