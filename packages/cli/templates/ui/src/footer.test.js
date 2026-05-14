import assert from "node:assert";
import { test } from "node:test";
import { Footer } from "./footer.js";

test("Footer - exports correctly", () => {
	assert.strictEqual(typeof Footer, "function");
});

test("Footer - renders with default props", () => {
	const result = Footer({});
	assert.ok(result);
	assert.strictEqual(result.type, "footer");
});

test("Footer - accepts custom columns", () => {
	const result = Footer({
		columns: [
			{ title: "Navigate", links: [{ label: "About", href: "/about" }] },
			{ title: "Explore", links: [{ label: "Work", href: "/work" }] },
			{ title: "Contact", links: [{ label: "hello@example.com" }] },
		],
	});
	assert.ok(result);
});
