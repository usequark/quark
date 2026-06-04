import assert from "node:assert";
import { test } from "node:test";
import { Container } from "./container.js";

test("Container - exports correctly", () => {
	assert(typeof Container === "function");
});

test("Container - has expected function name", () => {
	assert.strictEqual(Container.name, "Container");
});

test("Container - renders with default props", () => {
	const result = Container({});
	assert.ok(result);
});

test("Container - renders children", () => {
	const result = Container({ children: "Hello" });
	assert.equal(result.props.children, "Hello");
});

test("Container - accepts className override", () => {
	const result = Container({ className: "custom-class" });
	assert.match(result.props.className, /custom-class/);
});

test("Container - preserves section element", () => {
	const result = Container({});
	assert.equal(result.type, "section");
});
