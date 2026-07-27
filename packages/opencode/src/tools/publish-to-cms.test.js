import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { publishToCms } from "./publish-to-cms.js";

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

const argsSchema = z.object(publishToCms.args);

describe("publishToCms", () => {
	test("has expected tool shape", () => {
		assert.equal(typeof publishToCms.description, "string");
		assert.ok(publishToCms.description.length > 0);
		assert.equal(typeof publishToCms.execute, "function");
		assert.ok(publishToCms.args.contentId);
		assert.ok(publishToCms.args.title);
		assert.ok(publishToCms.args.body);
		assert.ok(publishToCms.args.scheduledDate);
	});

	test("returns success response for valid args", async () => {
		const args = {
			contentId: "post-123",
			title: "Hello World",
			body: "Body content here",
		};

		const result = await publishToCms.execute(args, mockContext());
		assert.equal(typeof result, "string");

		const parsed = JSON.parse(result);
		assert.equal(parsed.success, true);
		assert.equal(parsed.contentId, "post-123");
		assert.match(parsed.message, /Published "Hello World" \(post-123\)/);
		assert.match(parsed.message, /immediate publication/);
		assert.equal(typeof parsed.publishedAt, "string");
		assert.ok(!Number.isNaN(Date.parse(parsed.publishedAt)));
	});

	test("includes scheduled date in response when provided", async () => {
		const scheduledDate = "2026-08-01T12:00:00.000Z";
		const args = {
			contentId: "post-456",
			title: "Scheduled Post",
			body: "Later",
			scheduledDate,
		};

		const result = await publishToCms.execute(args, mockContext());
		const parsed = JSON.parse(result);

		assert.equal(parsed.success, true);
		assert.equal(parsed.publishedAt, scheduledDate);
		assert.match(parsed.message, /scheduled for 2026-08-01T12:00:00\.000Z/);
	});

	describe("argument validation", () => {
		test("accepts valid required args", () => {
			const parsed = argsSchema.parse({
				contentId: "id-1",
				title: "Title",
				body: "Body",
			});
			assert.equal(parsed.contentId, "id-1");
			assert.equal(parsed.title, "Title");
			assert.equal(parsed.body, "Body");
			assert.equal(parsed.scheduledDate, undefined);
		});

		test("accepts optional scheduledDate", () => {
			const parsed = argsSchema.parse({
				contentId: "id-1",
				title: "Title",
				body: "Body",
				scheduledDate: "2026-01-01T00:00:00.000Z",
			});
			assert.equal(parsed.scheduledDate, "2026-01-01T00:00:00.000Z");
		});

		test("rejects missing contentId", () => {
			assert.throws(
				() => argsSchema.parse({ title: "T", body: "B" }),
				(err) => err instanceof z.ZodError,
			);
		});

		test("rejects missing title", () => {
			assert.throws(
				() => argsSchema.parse({ contentId: "id", body: "B" }),
				(err) => err instanceof z.ZodError,
			);
		});

		test("rejects missing body", () => {
			assert.throws(
				() => argsSchema.parse({ contentId: "id", title: "T" }),
				(err) => err instanceof z.ZodError,
			);
		});

		test("rejects non-string contentId", () => {
			assert.throws(
				() =>
					argsSchema.parse({
						contentId: 123,
						title: "T",
						body: "B",
					}),
				(err) => err instanceof z.ZodError,
			);
		});
	});
});
