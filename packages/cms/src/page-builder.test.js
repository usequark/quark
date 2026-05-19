import assert from "node:assert/strict";
import { test } from "node:test";

import {
	createPageBlock,
	hasRenderablePageContent,
	normalizePageContent,
	parsePageBuilderInput,
	parseStoredPageContent,
	serializePageContentToBody,
	serializePageContentToPlainText,
} from "./page-builder.js";

test("parsePageBuilderInput parses JSON content and preserves layout", () => {
	const result = parsePageBuilderInput({
		layout: "immersive",
		content: JSON.stringify([
			createPageBlock("hero", {
				title: "Welcome",
				subtitle: "Hello",
				backgroundMode: "animation",
				backgroundValue: "background-waves",
				backgroundTone: "info",
			}),
		]),
	});

	assert.equal(result.layout, "immersive");
	assert.equal(result.content[0].type, "hero");
	assert.equal(result.content[0].backgroundValue, "background-waves");
	assert.equal(result.content[0].backgroundTone, "info");
});

test("normalizePageContent falls back to a default block from legacy body", () => {
	const result = normalizePageContent(null, "<p>Legacy body</p>");

	assert.equal(result.length, 1);
	assert.equal(result[0].id, "page-block-legacy-body");
	assert.equal(result[0].type, "default");
	assert.match(result[0].body, /Legacy body/);
});

test("normalizePageContent sanitizes legacy body fallback HTML", () => {
	const result = normalizePageContent(
		null,
		'<p onclick="alert(1)">Legacy</p><script>alert(1)</script><a href="javascript:alert(1)">Bad</a><a href=javascript:alert(1)>Also bad</a>',
	);

	assert.equal(result.length, 1);
	assert.equal(result[0].type, "default");
	assert.doesNotMatch(result[0].body, /onclick=/);
	assert.doesNotMatch(result[0].body, /<script/i);
	assert.doesNotMatch(result[0].body, /javascript:/i);
	assert.match(result[0].body, /Legacy/);
});

test("parseStoredPageContent migrates legacy cta and richText blocks", () => {
	const content = parseStoredPageContent([
		{
			id: "legacy-cta",
			type: "cta",
			title: "Ready",
			body: "Start today",
			buttonLabel: "Get Started",
			buttonHref: "/start",
		},
		{
			id: "legacy-rich",
			type: "richText",
			html: "<p>Rich body</p>",
		},
	]);

	assert.equal(content?.length, 2);
	assert.equal(content?.[0].type, "cta");
	assert.equal(content?.[0].primaryLabel, "Get Started");
	assert.equal(content?.[0].subtitle, "Start today");
	assert.equal(content?.[1].type, "default");
	assert.match(content?.[1].body ?? "", /Rich body/);
});

test("normalizePageContent uses stable fallback IDs across repeated calls", () => {
	const firstLegacyResult = normalizePageContent(null, "<p>Legacy body</p>");
	const secondLegacyResult = normalizePageContent(null, "<p>Legacy body</p>");
	const firstEmptyResult = normalizePageContent(null, "");
	const secondEmptyResult = normalizePageContent(null, "");

	assert.equal(firstLegacyResult[0].id, secondLegacyResult[0].id);
	assert.equal(firstEmptyResult[0].id, secondEmptyResult[0].id);
	assert.equal(firstEmptyResult[0].id, "page-block-initial-default");
});

test("serializePageContentToBody renders all supported block types", () => {
	const content = [
		createPageBlock("hero", {
			title: "Hero title",
			subtitle: "Hero subtitle",
			backgroundMode: "animation",
			backgroundValue: "background-waves",
		}),
		createPageBlock("default", {
			eyebrow: "Overview",
			title: "Default title",
			body: "Supporting copy",
		}),
		createPageBlock("split", {
			title: "Split title",
			leftKind: "image",
			leftSrc: "/api/media/example.jpg",
			leftAlt: "Example image",
			rightKind: "text",
			rightBody: "Right column copy",
		}),
		createPageBlock("cta", {
			title: "Ready to start?",
			subtitle: "Let us help.",
			primaryLabel: "Contact sales",
			primaryHref: "/contact",
		}),
	];

	const html = serializePageContentToBody(content);

	assert.match(html, /Hero title/);
	assert.match(html, /Default title/);
	assert.match(html, /img src="\/api\/media\/example\.jpg"/);
	assert.match(html, /Contact sales/);
	assert.match(serializePageContentToPlainText(content), /Ready to start/);
});

test("hasRenderablePageContent ignores empty placeholder blocks", () => {
	assert.equal(hasRenderablePageContent([createPageBlock("default")]), false);
	assert.equal(
		hasRenderablePageContent([
			createPageBlock("cta", {
				primaryLabel: "Learn more",
				primaryHref: "/demo",
			}),
		]),
		true,
	);
});
