import assert from "node:assert";
import { test } from "node:test";
import Link from "next/link.js";
import React from "react";
import { Button } from "./button.js";

test("Button - component exports correctly", () => {
	assert(typeof Button === "function", "Button should be a function");
});

test("Button - renders with default props", () => {
	const result = Button({});
	assert.ok(result, "Component should return an element");
});

test("Button - supports primary variant", () => {
	const result = Button({ variant: "primary" });
	assert.ok(result);
});

test("Button - supports secondary variant", () => {
	const result = Button({ variant: "secondary" });
	assert.ok(result);
});

test("Button - supports danger variant", () => {
	const result = Button({ variant: "danger" });
	assert.ok(result);
});

test("Button - supports ghost variant", () => {
	const result = Button({ variant: "ghost" });
	assert.ok(result);
});

test("Button - supports sm size", () => {
	const result = Button({ size: "sm" });
	assert.ok(result);
});

test("Button - supports md size", () => {
	const result = Button({ size: "md" });
	assert.ok(result);
});

test("Button - supports lg size", () => {
	const result = Button({ size: "lg" });
	assert.ok(result);
	assert.match(result.props.className, /text-base/);
});

test("Button - accepts className override", () => {
	const result = Button({ className: "custom-class" });
	assert.ok(result);
});

test("Button - renders icon with label", () => {
	const result = Button({
		icon: React.createElement("svg", { className: "icon-child" }),
		children: "Continue",
	});

	assert.ok(result);
	assert.match(result.props.className, /gap-2/);
	assert.equal(result.props.children.length, 2);
	assert.match(result.props.children[0].props.className, /icon-child/);
	assert.equal(result.props.children[1], "Continue");
});

test("Button - icon scales independently from text size", () => {
	const result = Button({
		size: "lg",
		icon: React.createElement("svg", { className: "icon-child" }),
		children: "Large",
	});

	assert.ok(result);
	assert.match(result.props.className, /text-base/);
});

test("Button - renders Next Link when href is provided", () => {
	const result = Button({ href: "/docs", children: "Docs" });

	assert.ok(result);
	assert.equal(result.type, Link);
	assert.equal(result.props.href, "/docs");
});

test("Button - adds noopener noreferrer for target blank links", () => {
	const result = Button({
		href: "https://example.com",
		target: "_blank",
		children: "External",
	});

	assert.ok(result);
	assert.equal(result.type, Link);
	assert.equal(result.props.rel, "noopener noreferrer");
});

test("Button - loading adds spinner and disables button", () => {
	const result = Button({ loading: true, children: "Save" });

	assert.ok(result);
	assert.equal(result.props.disabled, true);
	// First child should be the Spinner
	assert.match(result.props.children[0].type?.name ?? "", /Spinner/);
});

test("Button - loading on link sets aria-disabled", () => {
	const result = Button({
		href: "/docs",
		loading: true,
		children: "Save",
	});

	assert.ok(result);
	assert.equal(result.type, Link);
	assert.equal(result.props["aria-disabled"], true);
	assert.equal(result.props.href, undefined);
});
