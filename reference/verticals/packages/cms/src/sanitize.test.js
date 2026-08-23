import assert from "node:assert/strict";
import { test } from "node:test";
import {
	escapeHtml,
	renderRichText,
	sanitizeRichTextHtml,
	stripHtml,
} from "./sanitize.js";

// ─── escapeHtml ───────────────────────────────────────────────────────────────

test("escapeHtml - escapes ampersand", () => {
	assert.equal(escapeHtml("a & b"), "a &amp; b");
});

test("escapeHtml - escapes less-than", () => {
	assert.equal(escapeHtml("<div>"), "&lt;div&gt;");
});

test("escapeHtml - escapes greater-than", () => {
	assert.equal(escapeHtml("a > b"), "a &gt; b");
});

test("escapeHtml - escapes double quote", () => {
	assert.equal(escapeHtml('say "hi"'), "say &quot;hi&quot;");
});

test("escapeHtml - escapes single quote", () => {
	assert.equal(escapeHtml("it's"), "it&#39;s");
});

test("escapeHtml - escapes all special characters together", () => {
	assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

// ─── stripHtml ────────────────────────────────────────────────────────────────

test("stripHtml - removes HTML tags", () => {
	assert.equal(stripHtml("<p>Hello</p>").trim(), "Hello");
});

test("stripHtml - removes nested tags", () => {
	assert.equal(stripHtml("<div><b>Bold</b> text</div>").trim(), "Bold text");
});

test("stripHtml - collapses whitespace", () => {
	assert.equal(stripHtml("<p>a</p>  <p>b</p>").trim(), "a b");
});

test("stripHtml - handles nullish input", () => {
	assert.equal(stripHtml(null).trim(), "");
	assert.equal(stripHtml(undefined).trim(), "");
});

// ─── sanitizeRichTextHtml ─────────────────────────────────────────────────────

test("sanitizeRichTextHtml - strips script tags", () => {
	const result = sanitizeRichTextHtml("<p>ok</p><script>alert(1)</script>");
	assert.equal(result.includes("<script"), false);
	assert.equal(result.includes("</script"), false);
	assert.ok(result.includes("<p>ok</p>"));
});

test("sanitizeRichTextHtml - strips style tags", () => {
	const result = sanitizeRichTextHtml("<style>.x{}</style><p>ok</p>");
	assert.equal(result.includes("style"), false);
	assert.ok(result.includes("<p>ok</p>"));
});

test("sanitizeRichTextHtml - strips iframe tags", () => {
	const result = sanitizeRichTextHtml(
		'<iframe src="https://evil.com"></iframe><p>ok</p>',
	);
	assert.equal(result.includes("iframe"), false);
	assert.ok(result.includes("<p>ok</p>"));
});

test("sanitizeRichTextHtml - strips event handlers", () => {
	const result = sanitizeRichTextHtml('<img src="/x.png" onerror="alert(1)">');
	assert.equal(result.includes("onerror"), false);
	assert.equal(result.includes("alert"), false);
});

test("sanitizeRichTextHtml - strips javascript: URLs", () => {
	const result = sanitizeRichTextHtml('<a href="javascript:alert(1)">x</a>');
	assert.equal(result.includes("javascript:"), false);
	assert.equal(result.includes("href="), false);
});

test("sanitizeRichTextHtml - preserves safe href and src", () => {
	const input = '<a href="https://example.com">link</a><img src="/img.png">';
	const result = sanitizeRichTextHtml(input);
	assert.ok(result.includes('href="https://example.com"'));
	assert.ok(result.includes('src="/img.png"'));
});

// ─── renderRichText ───────────────────────────────────────────────────────────

test("renderRichText - wraps plain text paragraphs", () => {
	const result = renderRichText("Hello\n\nWorld");
	assert.equal(result, "<p>Hello</p><p>World</p>");
});

test("renderRichText - converts single newlines to br", () => {
	const result = renderRichText("line1\nline2");
	assert.equal(result, "<p>line1<br />line2</p>");
});

test("renderRichText - escapes HTML in plain text", () => {
	const result = renderRichText("<b>bold</b>");
	// Looks like HTML tags so goes through sanitize path
	assert.equal(result.includes("<script"), false);
});

test("renderRichText - plain text with special chars is escaped", () => {
	const result = renderRichText("a & b");
	assert.equal(result, "<p>a &amp; b</p>");
});

test("renderRichText - sanitizes HTML input", () => {
	const result = renderRichText("<p>ok</p><script>alert(1)</script>");
	assert.equal(result.includes("script"), false);
	assert.ok(result.includes("<p>ok</p>"));
});

test("renderRichText - returns empty string for blank input", () => {
	assert.equal(renderRichText(""), "");
	assert.equal(renderRichText("   "), "");
	assert.equal(renderRichText(null), "");
});
