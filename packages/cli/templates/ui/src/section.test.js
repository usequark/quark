import assert from "node:assert";
import { test } from "node:test";
import { Button } from "./button.js";
import {
	SECTION_VARIANTS,
	Section,
	SectionCta,
	SectionDefault,
	SectionHero,
	SectionSplit,
} from "./section.js";

test("Section exports correctly", () => {
	assert(typeof Section === "function");
	assert(typeof SectionHero === "function");
	assert(typeof SectionDefault === "function");
	assert(typeof SectionSplit === "function");
	assert(typeof SectionCta === "function");
	assert.deepEqual(SECTION_VARIANTS, ["hero", "default", "split", "cta"]);
});

test("Section renders each variant", () => {
	assert.ok(Section({ type: "hero" }));
	assert.ok(Section({ type: "default" }));
	assert.ok(Section({ type: "split" }));
	assert.ok(Section({ type: "cta" }));
});

test("Section falls back to default variant", () => {
	const result = Section({ type: "unknown" });
	assert.ok(result);
});

test("Section split can render image columns", () => {
	const result = SectionSplit({
		leftKind: "image",
		leftSrc: "/left.jpg",
		rightKind: "image",
		rightSrc: "/right.jpg",
	});
	assert.ok(result);
});

test("Section hero can render eyebrow above heading", () => {
	const result = SectionHero({
		eyebrow: "Launch",
		title: "Hero",
		subtitle: "Supporting copy",
	});

	const content = result.props.children[1].props.children;
	const heroChildren = content.props.children;

	assert.equal(heroChildren[0].type, "p");
	assert.equal(heroChildren[0].props.children, "Launch");
	assert.equal(heroChildren[1].type, "h2");
});

test("Section split text columns render without panel styling", () => {
	const result = SectionSplit({
		leftKind: "text",
		rightKind: "text",
	});

	const grid = result.props.children.props.children[1];
	const leftColumn = grid.props.children[0];

	assert.equal(leftColumn.type, "div");
	assert.doesNotMatch(leftColumn.props.className, /border|rounded|bg-bg/);
});

test("Section CTA actions are rendered with the Button component", () => {
	const result = SectionCta({
		title: "Take action",
		subtitle: "Choose next step",
		primaryAction: { label: "Primary", href: "/primary" },
		secondaryAction: { label: "Secondary", href: "/secondary" },
	});

	const content = result.props.children[1].props.children;
	const actions = content.props.children[2];

	assert.equal(actions.props.children[0].type, Button);
	assert.equal(actions.props.children[0].props.href, "/primary");
	assert.equal(actions.props.children[1].type, Button);
	assert.equal(actions.props.children[1].props.href, "/secondary");
});
