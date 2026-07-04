import assert from "node:assert";
import { describe, test } from "node:test";
import { buildPromptMessages, shouldCompact } from "./truncation.js";

describe("buildPromptMessages", () => {
	const systemPrompt = "You are a helpful assistant.";
	const model = "anthropic/claude-3.5-sonnet";

	test("returns system message only for empty messages", () => {
		const result = buildPromptMessages({
			messages: [],
			model,
			systemPrompt,
		});

		assert.strictEqual(result.messages.length, 1);
		assert.strictEqual(result.messages[0].role, "system");
		assert.strictEqual(result.messages[0].content, systemPrompt);
		assert.strictEqual(result.wasTruncated, false);
		assert.strictEqual(result.droppedCount, 0);
	});

	test("returns system message only for null messages", () => {
		const result = buildPromptMessages({
			messages: null,
			model,
			systemPrompt,
		});

		assert.strictEqual(result.messages.length, 1);
		assert.strictEqual(result.wasTruncated, false);
	});

	test("includes summary when provided", () => {
		const result = buildPromptMessages({
			messages: [{ role: "user", content: "Hello" }],
			summary: "User greeted the assistant",
			summaryTokens: 10,
			model,
			systemPrompt,
		});

		assert.strictEqual(result.messages.length, 3); // system + summary + message
		assert.strictEqual(result.messages[1].role, "system");
		assert.ok(
			result.messages[1].content.includes("Context from earlier conversation"),
		);
		assert.ok(
			result.messages[1].content.includes("User greeted the assistant"),
		);
	});

	test("truncates oldest messages when over budget", () => {
		// Create messages that would exceed the budget
		// Each message: 14 overhead + 250 content = 264 tokens
		// 600 messages = ~158,400 tokens > 151,200 budget
		const messages = [];
		for (let i = 0; i < 600; i++) {
			messages.push({
				role: "user",
				content: `Message ${i}: ${"a".repeat(1000)}`,
			});
		}

		const result = buildPromptMessages({
			messages,
			model,
			systemPrompt,
		});

		assert.ok(result.messages.length < messages.length + 1); // Less than all messages + system
		assert.strictEqual(result.wasTruncated, true);
		assert.ok(result.droppedCount > 0);
	});

	test("retains most recent messages when truncating", () => {
		const messages = [];
		for (let i = 0; i < 600; i++) {
			messages.push({
				role: "user",
				content: `Message ${i}: ${"a".repeat(1000)}`,
			});
		}

		const result = buildPromptMessages({
			messages,
			model,
			systemPrompt,
		});

		// The last message should be retained
		const lastRetained = result.messages[result.messages.length - 1];
		assert.ok(lastRetained.content.includes("Message 599"));
	});

	test("returns correct token counts", () => {
		const result = buildPromptMessages({
			messages: [{ role: "user", content: "Hello" }],
			model,
			systemPrompt,
		});

		assert.ok(result.estimatedTokens > 0);
	});
});

describe("shouldCompact", () => {
	test("returns true when over threshold", () => {
		// Create messages that exceed 75% of budget
		const messages = [];
		for (let i = 0; i < 50; i++) {
			messages.push({
				role: "user",
				content: `Message ${i}: ${"a".repeat(1000)}`,
			});
		}

		const result = shouldCompact({
			messages,
			tokenBudget: 10_000,
			threshold: 0.75,
		});

		assert.strictEqual(result, true);
	});

	test("returns false when under threshold", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
		];

		const result = shouldCompact({
			messages,
			tokenBudget: 100_000,
			threshold: 0.75,
		});

		assert.strictEqual(result, false);
	});

	test("uses default threshold of 0.75", () => {
		const messages = [];
		for (let i = 0; i < 50; i++) {
			messages.push({
				role: "user",
				content: `Message ${i}: ${"a".repeat(1000)}`,
			});
		}

		// Should compact when over 75%
		const result = shouldCompact({
			messages,
			tokenBudget: 10_000,
		});

		assert.strictEqual(result, true);
	});
});
