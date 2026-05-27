import assert from "node:assert";
import { test } from "node:test";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./card.js";

test("Card - exports correctly", () => {
	assert(typeof Card === "function");
});

test("CardHeader - exports correctly", () => {
	assert(typeof CardHeader === "function");
});

test("CardTitle - exports correctly", () => {
	assert(typeof CardTitle === "function");
});

test("CardContent - exports correctly", () => {
	assert(typeof CardContent === "function");
});

test("CardFooter - exports correctly", () => {
	assert(typeof CardFooter === "function");
});

test("Card - renders with default props", () => {
	const result = Card({});
	assert.ok(result);
});

test("CardHeader - renders with default props", () => {
	const result = CardHeader({});
	assert.ok(result);
});

test("CardTitle - renders with default props", () => {
	const result = CardTitle({});
	assert.ok(result);
});

test("CardContent - renders with default props", () => {
	const result = CardContent({});
	assert.ok(result);
});

test("CardFooter - renders with default props", () => {
	const result = CardFooter({});
	assert.ok(result);
});

test("Card - accepts className override", () => {
	const result = Card({ className: "custom" });
	assert.ok(result);
});

test("Card - supports collapsible variant", () => {
	const result = Card({
		variant: "collapsible",
		collapsibleLabel: "Details",
		children: "Body",
	});
	assert.ok(result);
	assert.strictEqual(typeof result.type, "function");
	assert.strictEqual(result.props.collapsibleLabel, "Details");
	assert.strictEqual(result.props.children, "Body");
});
