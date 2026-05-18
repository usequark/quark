import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationError } from "@techstream/quark-core";
import { parsePageFormData } from "./page-form.js";

const DEFAULT_CONTENT = [
	{
		id: "page-block-test-1",
		type: "richText",
		html: "Hello world",
	},
];

function makeFormData(overrides = {}) {
	const formData = new FormData();
	const values = {
		title: "About Quark",
		slug: "about-quark",
		layout: "standard",
		content: JSON.stringify(DEFAULT_CONTENT),
		excerpt: "Short summary",
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

	assert.deepStrictEqual(result, {
		title: "About Quark",
		slug: "about-quark",
		layout: "standard",
		content: DEFAULT_CONTENT,
		body: "Hello world",
		excerpt: "Short summary",
	});
});

test("parsePageFormData accepts an empty excerpt", () => {
	const result = parsePageFormData(makeFormData({ excerpt: "" }));

	assert.strictEqual(result.excerpt, "");
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
