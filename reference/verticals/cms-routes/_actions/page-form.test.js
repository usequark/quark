import assert from "node:assert/strict";
import { test } from "node:test";
import { createPageBlock } from "@techstream/quark-cms/page-builder";
import { ValidationError } from "@techstream/quark-core";
import { parsePageFormData, resolvePageSlugCandidate } from "./page-form.js";

const _DEFAULT_CONTENT = [
	{
		id: "page-block-test-1",
		type: "default",
		title: "About Quark",
		body: "Hello world",
	},
];

function makeFormData(overrides = {}) {
	const formData = new FormData();
	const values = {
		title: "About Quark",
		slug: "about-quark",
		excerpt: "Short summary",
		layout: "standard",
		content: JSON.stringify([
			createPageBlock("default", {
				title: "About Quark",
				body: "Hello world",
			}),
		]),
		...overrides,
	};

	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined) {
			formData.set(key, value);
		}
	}

	return formData;
}

test("parsePageFormData returns validated page input", () => {
	const result = parsePageFormData(makeFormData());

	assert.equal(result.title, "About Quark");
	assert.equal(result.slug, "about-quark");
	assert.equal(result.excerpt, "Short summary");
	assert.equal(result.layout, "standard");
	assert.equal(result.content[0].type, "default");
	assert.equal(result.content[0].title, "About Quark");
	assert.equal(result.content[0].body, "Hello world");
	assert.match(result.body, /<h2>About Quark<\/h2>/);
	assert.match(result.body, /<p>Hello world<\/p>/);
});

test("parsePageFormData accepts an empty excerpt", () => {
	const result = parsePageFormData(makeFormData({ excerpt: "" }));

	assert.strictEqual(result.excerpt, "");
});

test("parsePageFormData accepts a missing slug and defers generation", () => {
	const result = parsePageFormData(makeFormData({ slug: undefined }));

	assert.strictEqual(result.slug, "");
});

test("parsePageFormData reports a friendly message when content is empty", () => {
	assert.throws(
		() =>
			parsePageFormData(
				makeFormData({
					content: JSON.stringify([createPageBlock("default")]),
				}),
			),
		(error) =>
			error instanceof ValidationError &&
			error.message === "Add content to at least one section",
	);
});

test("parsePageFormData rejects invalid slugs", () => {
	assert.throws(
		() => parsePageFormData(makeFormData({ slug: "Bad Slug" })),
		(error) =>
			error instanceof ValidationError &&
			error.message ===
				"Slug must be lowercase letters, numbers, and hyphens only",
	);
});

test("parsePageFormData rejects reserved top-level slugs", () => {
	assert.throws(
		() => parsePageFormData(makeFormData({ slug: "admin" })),
		(error) =>
			error instanceof ValidationError &&
			error.message === "Slug is reserved for an existing route",
	);
});

test("resolvePageSlugCandidate rejects reserved generated slugs", () => {
	assert.throws(
		() => resolvePageSlugCandidate({ title: "Admin", slug: "" }),
		(error) =>
			error instanceof ValidationError &&
			error.message === "Slug is reserved for an existing route",
	);
});

test("resolvePageSlugCandidate rejects punctuation-only generated slugs", () => {
	assert.throws(
		() => resolvePageSlugCandidate({ title: "!!!", slug: "" }),
		(error) =>
			error instanceof ValidationError &&
			error.message ===
				"Add a custom slug when the title cannot be converted into a URL path",
	);
});

test("resolvePageSlugCandidate rejects unicode-only generated slugs", () => {
	assert.throws(
		() => resolvePageSlugCandidate({ title: "\u4F60\u597D", slug: "" }),
		(error) =>
			error instanceof ValidationError &&
			error.message ===
				"Add a custom slug when the title cannot be converted into a URL path",
	);
});
