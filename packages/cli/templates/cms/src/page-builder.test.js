import assert from "node:assert/strict";
import { test } from "node:test";

import {
	createPageBlock,
	hasRenderablePageContent,
	normalizePageContent,
	parsePageBuilderInput,
	serializePageContentToBody,
	serializePageContentToPlainText,
} from "./page-builder.js";

test("parsePageBuilderInput parses JSON content and preserves layout", () => {
	const result = parsePageBuilderInput({
		layout: "immersive",
		content: JSON.stringify([
			createPageBlock("richText", { html: "<h1>Welcome</h1><p>Hello</p>" }),
		]),
	});

	assert.equal(result.layout, "immersive");
	assert.equal(result.content[0].type, "richText");
	assert.match(result.content[0].html, /Welcome/);
});

test("normalizePageContent falls back to a rich text block from legacy body", () => {
	const result = normalizePageContent(null, "<p>Legacy body</p>");

	assert.equal(result.length, 1);
	assert.equal(result[0].id, "page-block-legacy-body");
	assert.equal(result[0].type, "richText");
	assert.match(result[0].html, /Legacy body/);
});

test("normalizePageContent sanitizes legacy body fallback HTML", () => {
	const result = normalizePageContent(
		null,
		'<p onclick="alert(1)">Legacy</p><script>alert(1)</script><a href="javascript:alert(1)">Bad</a><a href=javascript:alert(1)>Also bad</a>',
	);

	assert.equal(result.length, 1);
	assert.equal(result[0].type, "richText");
	assert.doesNotMatch(result[0].html, /onclick=/);
	assert.doesNotMatch(result[0].html, /<script/i);
	assert.doesNotMatch(result[0].html, /javascript:/i);
	assert.match(result[0].html, /Legacy/);
});

test("createPageBlock strips unquoted javascript URLs from rich text", () => {
	const block = createPageBlock("richText", {
		html: "<a href=javascript:alert(1)>Click</a>",
	});

	assert.doesNotMatch(block.html, /javascript:/i);
	assert.match(block.html, /Click/);
});

test("normalizePageContent uses stable fallback IDs across repeated calls", () => {
	const firstLegacyResult = normalizePageContent(null, "<p>Legacy body</p>");
	const secondLegacyResult = normalizePageContent(null, "<p>Legacy body</p>");
	const firstEmptyResult = normalizePageContent(null, "");
	const secondEmptyResult = normalizePageContent(null, "");

	assert.equal(firstLegacyResult[0].id, secondLegacyResult[0].id);
	assert.equal(firstEmptyResult[0].id, secondEmptyResult[0].id);
	assert.equal(firstEmptyResult[0].id, "page-block-initial-rich-text");
});

test("serializePageContentToBody renders all supported block types", () => {
	const content = [
		createPageBlock("richText", { html: "<p>Hello world</p>" }),
		createPageBlock("image", {
			src: "/api/media/example.jpg",
			alt: "Example image",
			caption: "Screenshot",
		}),
		createPageBlock("mediaText", {
			title: "Two-column section",
			body: "Supporting copy",
			src: "/api/media/side.jpg",
		}),
		createPageBlock("cta", {
			title: "Ready to start?",
			body: "Let us help.",
			buttonLabel: "Contact sales",
			buttonHref: "/contact",
		}),
	];

	const html = serializePageContentToBody(content);

	assert.match(html, /Hello world/);
	assert.match(html, /img src="\/api\/media\/example\.jpg"/);
	assert.match(html, /Two-column section/);
	assert.match(html, /Contact sales/);
	assert.match(serializePageContentToPlainText(content), /Ready to start/);
});

test("hasRenderablePageContent ignores empty placeholder blocks", () => {
	assert.equal(hasRenderablePageContent([createPageBlock("richText")]), false);
	assert.equal(
		hasRenderablePageContent([
			createPageBlock("cta", {
				buttonLabel: "Learn more",
				buttonHref: "/demo",
			}),
		]),
		true,
	);
});
