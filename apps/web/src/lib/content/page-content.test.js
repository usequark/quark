import assert from "node:assert/strict";
import test from "node:test";

import {
	normalizePageContent,
	parseStoredPageContent,
} from "./page-content.js";

test("parseStoredPageContent parses section blocks", () => {
	const blocks = parseStoredPageContent(
		JSON.stringify([
			{
				id: "hero",
				type: "hero",
				title: "Launch",
				subtitle: "Ship with confidence",
				backgroundMode: "animation",
				backgroundValue: "background-waves",
			},
		]),
	);

	assert.deepEqual(blocks, [
		{
			id: "hero",
			type: "hero",
			eyebrow: "",
			title: "Launch",
			subtitle: "Ship with confidence",
			backgroundMode: "animation",
			backgroundValue: "background-waves",
			backgroundTone: "primary",
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
			type: "default",
			eyebrow: "",
			title: "",
			body: "Hello alert(1)",
		},
	]);
});

test("parseStoredPageContent migrates legacy cta links and strips unsafe URLs", () => {
	const blocks = parseStoredPageContent([
		{
			id: "cta",
			type: "cta",
			title: "Open",
			buttonLabel: "Open",
			buttonHref: "javascript:alert(1)",
		},
	]);

	assert.deepEqual(blocks, [
		{
			id: "cta",
			type: "cta",
			title: "Open",
			subtitle: "",
			primaryLabel: "Open",
			primaryHref: "",
			secondaryLabel: "",
			secondaryHref: "",
			backgroundMode: "color",
			backgroundValue: "primary",
			backgroundTone: "primary",
		},
	]);
});

test("parseStoredPageContent migrates legacy richText to default body", () => {
	const blocks = parseStoredPageContent([
		{
			id: "legacy-rich",
			type: "richText",
			html: "<h2>Heading</h2><p>Paragraph</p>",
		},
	]);

	assert.deepEqual(blocks, [
		{
			id: "legacy-rich",
			type: "default",
			eyebrow: "",
			title: "",
			body: "<h2>Heading</h2><p>Paragraph</p>",
		},
	]);
});
