import assert from "node:assert";
import { describe, test } from "node:test";
import {
	estimateMessageTokens,
	estimateTokens,
	getModelBudget,
} from "./tokens.js";

describe("estimateTokens", () => {
	test("returns 0 for null or empty string", () => {
		assert.strictEqual(estimateTokens(null), 0);
		assert.strictEqual(estimateTokens(""), 0);
		assert.strictEqual(estimateTokens(undefined), 0);
	});

	test("estimates tokens correctly for a string", () => {
		// 100 chars / 4 = 25 tokens
		const text = "a".repeat(100);
		assert.strictEqual(estimateTokens(text), 25);
	});

	test("rounds up for non-divisible lengths", () => {
		// 101 chars / 4 = 25.25 → 26 tokens
		const text = "a".repeat(101);
		assert.strictEqual(estimateTokens(text), 26);
	});

	test("handles single character", () => {
		assert.strictEqual(estimateTokens("a"), 1);
	});
});

describe("estimateMessageTokens", () => {
	test("returns 0 for empty array", () => {
		assert.strictEqual(estimateMessageTokens([]), 0);
	});

	test("returns 0 for null", () => {
		assert.strictEqual(estimateMessageTokens(null), 0);
	});

	test("estimates tokens for message with content", () => {
		const messages = [{ role: "user", content: "a".repeat(100) }];
		// 14 overhead + 25 tokens = 39
		const result = estimateMessageTokens(messages);
		assert.strictEqual(result, 39);
	});

	test("estimates tokens for message with tool_calls", () => {
		const messages = [
			{
				role: "assistant",
				content: "Let me search",
				tool_calls: [
					{ function: { name: "search", arguments: '{"q":"test"}' } },
				],
			},
		];
		const result = estimateMessageTokens(messages);
		assert.ok(result > 14); // At least overhead
	});

	test("estimates tokens for message with tool_results", () => {
		const messages = [
			{
				role: "tool",
				tool_results: [{ result: "a".repeat(200) }],
			},
		];
		const result = estimateMessageTokens(messages);
		// 14 overhead + ceil(214/4) tokens for tool_results = 14 + 54 = 68
		// JSON.stringify([{result:"aaa..."}]) = ~214 chars
		assert.strictEqual(result, 68);
	});

	test("sums tokens across multiple messages", () => {
		const messages = [
			{ role: "user", content: "a".repeat(40) },
			{ role: "assistant", content: "b".repeat(40) },
		];
		// (14 + 10) + (14 + 10) = 48
		const result = estimateMessageTokens(messages);
		assert.strictEqual(result, 48);
	});
});

describe("getModelBudget", () => {
	test("returns correct budget for known models", () => {
		// Claude 3.5: 200k - 8k - 2.5k - 0.5k = 189k, * 0.8 = 151,200
		const budget = getModelBudget("anthropic/claude-3.5-sonnet");
		assert.strictEqual(budget, 151_200);
	});

	test("returns correct budget for deepseek v4 flash", () => {
		// 1M - 8k - 2.5k - 0.5k = 989k, * 0.8 = 791,200
		const budget = getModelBudget("deepseek/deepseek-v4-flash");
		assert.strictEqual(budget, 791_200);
	});

	test("falls back to default for unknown models", () => {
		// Default 128k - 8k - 2.5k - 0.5k = 117k, * 0.8 = 93,600
		const budget = getModelBudget("unknown/model");
		assert.strictEqual(budget, 93_600);
	});

	test("respects custom options", () => {
		const budget = getModelBudget("openai/gpt-4o", {
			responseReserved: 16_000,
			toolsReserved: 5_000,
			systemReserved: 1_000,
		});
		// 128k - 16k - 5k - 1k = 106k, * 0.8 = 84,800
		assert.strictEqual(budget, 84_800);
	});
});
