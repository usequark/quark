import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { outputComposer } from "./output-composer.js";

/**
 * @param {Array<{type: string, text?: string}>} parts
 */
function makeOutput(parts) {
	return {
		messages: [{ info: {}, parts }],
	};
}

describe("outputComposer", () => {
	test("leaves empty parts array unchanged", async () => {
		const output = makeOutput([]);
		await outputComposer({}, output);

		assert.deepEqual(output.messages[0].parts, []);
	});

	test("leaves single text part unchanged", async () => {
		const parts = [{ type: "text", text: "Hello world" }];
		const output = makeOutput(parts);
		await outputComposer({}, output);

		assert.equal(output.messages[0].parts.length, 1);
		assert.deepEqual(output.messages[0].parts[0], {
			type: "text",
			text: "Hello world",
		});
	});

	test("composes multiple text parts into structured JSON", async () => {
		const parts = [
			{ type: "text", text: "First paragraph" },
			{ type: "text", text: "Second paragraph" },
		];
		const output = makeOutput(parts);
		await outputComposer({}, output);

		assert.equal(output.messages[0].parts.length, 1);
		assert.equal(output.messages[0].parts[0].type, "text");

		const parsed = JSON.parse(output.messages[0].parts[0].text);
		assert.equal(parsed.draft, "First paragraph\n\nSecond paragraph");
		assert.equal(parsed.metadata.partCount, 2);
		assert.equal(parsed.metadata.wordCount, 4);
	});

	test("does not compose when only one text part among non-text parts", async () => {
		const parts = [
			{ type: "text", text: "Only text" },
			{ type: "image", text: "ignored" },
			{ type: "tool-call" },
		];
		const output = makeOutput(parts);
		await outputComposer({}, output);

		assert.equal(output.messages[0].parts.length, 3);
		assert.deepEqual(output.messages[0].parts, parts);
	});

	test("composes multiple text parts and drops non-text parts", async () => {
		const parts = [
			{ type: "text", text: "Alpha" },
			{ type: "image" },
			{ type: "text", text: "Beta" },
		];
		const output = makeOutput(parts);
		await outputComposer({}, output);

		assert.equal(output.messages[0].parts.length, 1);
		const parsed = JSON.parse(output.messages[0].parts[0].text);
		assert.equal(parsed.draft, "Alpha\n\nBeta");
		assert.equal(parsed.metadata.partCount, 3);
		assert.equal(parsed.metadata.wordCount, 2);
	});

	test("handles missing text on text parts", async () => {
		const parts = [{ type: "text" }, { type: "text", text: "Present" }];
		const output = makeOutput(parts);
		await outputComposer({}, output);

		const parsed = JSON.parse(output.messages[0].parts[0].text);
		assert.equal(parsed.draft, "\n\nPresent");
	});

	test("processes multiple messages independently", async () => {
		const output = {
			messages: [
				{
					info: {},
					parts: [
						{ type: "text", text: "A" },
						{ type: "text", text: "B" },
					],
				},
				{
					info: {},
					parts: [{ type: "text", text: "Single" }],
				},
			],
		};
		await outputComposer({}, output);

		assert.equal(output.messages[0].parts.length, 1);
		const parsed = JSON.parse(output.messages[0].parts[0].text);
		assert.equal(parsed.draft, "A\n\nB");

		assert.equal(output.messages[1].parts.length, 1);
		assert.equal(output.messages[1].parts[0].text, "Single");
	});

	test("leaves messages with null/undefined parts unchanged", async () => {
		const output = {
			messages: [{ info: {}, parts: null }],
		};
		await outputComposer({}, output);
		assert.equal(output.messages[0].parts, null);
	});
});
