import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { checkCompliance } from "./check-compliance.js";

/** @returns {import("@opencode-ai/plugin").ToolContext} */
function mockContext() {
	return {
		sessionID: "test-session",
		messageID: "test-message",
		agent: "test-agent",
		directory: process.cwd(),
		worktree: process.cwd(),
		abort: new AbortController().signal,
		metadata() {},
		async ask() {},
	};
}

const argsSchema = z.object(checkCompliance.args);

describe("checkCompliance", () => {
	test("has expected tool shape", () => {
		assert.equal(typeof checkCompliance.description, "string");
		assert.ok(checkCompliance.description.length > 0);
		assert.equal(typeof checkCompliance.execute, "function");
		assert.ok(checkCompliance.args.content);
		assert.ok(checkCompliance.args.brandGuidelines);
	});

	test("returns success response for valid args", async () => {
		const args = {
			content: "Brand-compliant marketing copy.",
		};

		const result = await checkCompliance.execute(args, mockContext());
		assert.equal(typeof result, "string");

		const parsed = JSON.parse(result);
		assert.equal(parsed.passed, true);
		assert.deepEqual(parsed.issues, []);
		assert.equal(parsed.score, 0.95);
		assert.equal(typeof parsed.checkedAt, "string");
		assert.ok(!Number.isNaN(Date.parse(parsed.checkedAt)));
	});

	test("returns success response when brandGuidelines provided", async () => {
		const args = {
			content: "Some content",
			brandGuidelines: "Use formal tone",
		};

		const result = await checkCompliance.execute(args, mockContext());
		const parsed = JSON.parse(result);

		assert.equal(parsed.passed, true);
		assert.deepEqual(parsed.issues, []);
		assert.equal(parsed.score, 0.95);
	});

	describe("argument validation", () => {
		test("accepts valid required content", () => {
			const parsed = argsSchema.parse({ content: "Hello" });
			assert.equal(parsed.content, "Hello");
			assert.equal(parsed.brandGuidelines, undefined);
		});

		test("accepts optional brandGuidelines", () => {
			const parsed = argsSchema.parse({
				content: "Hello",
				brandGuidelines: "Be concise",
			});
			assert.equal(parsed.brandGuidelines, "Be concise");
		});

		test("rejects missing content", () => {
			assert.throws(
				() => argsSchema.parse({}),
				(err) => err instanceof z.ZodError,
			);
		});

		test("rejects non-string content", () => {
			assert.throws(
				() => argsSchema.parse({ content: 42 }),
				(err) => err instanceof z.ZodError,
			);
		});

		test("rejects non-string brandGuidelines", () => {
			assert.throws(
				() =>
					argsSchema.parse({
						content: "ok",
						brandGuidelines: { tone: "formal" },
					}),
				(err) => err instanceof z.ZodError,
			);
		});
	});
});
