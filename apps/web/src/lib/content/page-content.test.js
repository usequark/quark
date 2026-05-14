import assert from "node:assert/strict";
import test from "node:test";

import {
	normalizePageContent,
	parseStoredPageContent,
} from "./page-content.js";

test("parseStoredPageContent parses stored JSON blocks without CMS package helpers", () => {
	const blocks = parseStoredPageContent(
		JSON.stringify([
			{
				id: "hero",
				type: "cta",
				title: "Launch",
				buttonLabel: "Start",
				buttonHref: "/start",
			},
		]),
	);

	assert.deepEqual(blocks, [
		{
			id: "hero",
			type: "cta",
			eyebrow: "",
			title: "Launch",
			body: "",
			buttonLabel: "Start",
			buttonHref: "/start",
		},
	]);
});

test("normalizePageContent falls back to sanitized legacy body content", () => {
	const blocks = normalizePageContent(
		[],
		'<p onclick="evil()">Hello</p><script>alert(1)</script>',
	);

	assert.deepEqual(blocks, [
		{
			id: "page-block-legacy-body",
			type: "richText",
			html: "<p>Hello</p>alert(1)",
		},
	]);
});

test("normalizePageContent strips unquoted javascript URLs from legacy body content", () => {
	const blocks = normalizePageContent(
		[],
		"<a href=javascript:alert(1)>Click</a>",
	);

	assert.equal(blocks[0].html, "<a>Click</a>");
	assert.doesNotMatch(blocks[0].html, /javascript:/i);
});

test("parseStoredPageContent drops unsafe URLs from stored blocks", () => {
	const blocks = parseStoredPageContent([
		{
			id: "cta",
			type: "cta",
			buttonLabel: "Open",
			buttonHref: "javascript:alert(1)",
		},
	]);

	assert.deepEqual(blocks, [
		{
			id: "cta",
			type: "cta",
			eyebrow: "",
			title: "",
			body: "",
			buttonLabel: "Open",
			buttonHref: "",
		},
	]);
});
