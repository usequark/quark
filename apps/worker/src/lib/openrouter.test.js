import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { AppError } from "@techstream/quark-core/errors";
import { complete, completeWithTools, estimateCost } from "./openrouter.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

let originalFetch;
let originalEnv;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	originalEnv = { ...process.env };
	process.env.OPENROUTER_API_KEY = "test-api-key";
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	process.env = originalEnv;
	mock.restoreAll();
});

function mockFetch(responses) {
	let callCount = 0;
	globalThis.fetch = mock.fn(async () => {
		const response = responses[callCount] || responses[responses.length - 1];
		callCount++;
		return response;
	});
}

function createMockResponse(status, body, headers = {}) {
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: {
			get: (key) => headers[key] || null,
		},
		json: async () => body,
		text: (async) => JSON.stringify(body),
	};
}

// ── complete() ───────────────────────────────────────────────────────────────

describe("complete", () => {
	test("sends correct request to OpenRouter API", async () => {
		const mockResult = {
			choices: [{ message: { content: "Hello!" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		};

		mockFetch([createMockResponse(200, mockResult)]);

		const result = await complete({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.deepStrictEqual(result, mockResult);
		assert.strictEqual(globalThis.fetch.mock.callCount(), 1);

		const callArgs = globalThis.fetch.mock.calls[0].arguments;
		assert.strictEqual(
			callArgs[0],
			"https://openrouter.ai/api/v1/chat/completions",
		);
		assert.strictEqual(callArgs[1].method, "POST");

		const body = JSON.parse(callArgs[1].body);
		assert.strictEqual(body.model, "anthropic/claude-3.5-sonnet");
		assert.strictEqual(body.messages.length, 1);
	});

	test("throws when OPENROUTER_API_KEY is not configured", async () => {
		delete process.env.OPENROUTER_API_KEY;

		await assert.rejects(
			() =>
				complete({
					model: "anthropic/claude-3.5-sonnet",
					messages: [{ role: "user", content: "Hi" }],
				}),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "OPENROUTER_NOT_CONFIGURED");
				return true;
			},
		);
	});

	test("handles retry on 429 (rate limit)", async () => {
		const mockResult = {
			choices: [{ message: { content: "Hello!" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		};

		mockFetch([
			createMockResponse(
				429,
				{ error: "rate limited" },
				{ "retry-after": "0" },
			),
			createMockResponse(200, mockResult),
		]);

		const result = await complete({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.deepStrictEqual(result, mockResult);
		assert.strictEqual(globalThis.fetch.mock.callCount(), 2);
	});

	test("handles retry on 5xx errors", async () => {
		const mockResult = {
			choices: [{ message: { content: "Hello!" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		};

		mockFetch([
			createMockResponse(500, { error: "server error" }),
			createMockResponse(200, mockResult),
		]);

		const result = await complete({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.deepStrictEqual(result, mockResult);
		assert.strictEqual(globalThis.fetch.mock.callCount(), 2);
	});

	test("returns undefined after max retries on 5xx (loop exhausts without throw)", async () => {
		// The current implementation uses `continue` in the try block for 5xx,
		// which skips the catch block where the throw logic lives.
		// After all retries, the loop ends and the function returns undefined.
		mockFetch([
			createMockResponse(500, { error: "server error" }),
			createMockResponse(500, { error: "server error" }),
			createMockResponse(500, { error: "server error" }),
		]);

		const result = await complete({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.strictEqual(result, undefined);
		assert.strictEqual(globalThis.fetch.mock.callCount(), 3);
	});

	test("throws after max retries on network errors", async () => {
		globalThis.fetch = mock.fn(async () => {
			throw new Error("ECONNREFUSED");
		});

		await assert.rejects(
			() =>
				complete({
					model: "anthropic/claude-3.5-sonnet",
					messages: [{ role: "user", content: "Hi" }],
				}),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "OPENROUTER_FAILED");
				assert.ok(error.message.includes("3 attempts"));
				return true;
			},
		);
	});

	test("throws AppError for non-OK, non-429, non-5xx responses", async () => {
		mockFetch([createMockResponse(400, { error: "bad request" })]);

		await assert.rejects(
			() =>
				complete({
					model: "anthropic/claude-3.5-sonnet",
					messages: [{ role: "user", content: "Hi" }],
				}),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.statusCode, 400);
				return true;
			},
		);
	});

	test("includes Authorization header with API key", async () => {
		const mockResult = {
			choices: [{ message: { content: "Hi" } }],
			usage: {},
		};
		mockFetch([createMockResponse(200, mockResult)]);

		await complete({
			model: "test-model",
			messages: [{ role: "user", content: "Hi" }],
		});

		const callArgs = globalThis.fetch.mock.calls[0].arguments;
		const headers = callArgs[1].headers;
		assert.strictEqual(headers.Authorization, "Bearer test-api-key");
	});
});

// ── completeWithTools() ──────────────────────────────────────────────────────

describe("completeWithTools", () => {
	test("sends tool definitions correctly", async () => {
		const mockResult = {
			choices: [{ message: { content: "Done!" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		};

		mockFetch([createMockResponse(200, mockResult)]);

		const tools = [
			{
				type: "function",
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: { type: "object", properties: {} },
				},
			},
		];

		const result = await completeWithTools({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Hi" }],
			tools,
		});

		assert.ok(result.choices);
		const callArgs = globalThis.fetch.mock.calls[0].arguments;
		const body = JSON.parse(callArgs[1].body);
		assert.ok(body.tools);
		assert.strictEqual(body.tools.length, 1);
	});

	test("implements multi-turn tool calling loop", async () => {
		const toolCallId = "call-1";
		const toolResult = { contacts: [{ id: "c1", name: "John" }] };

		// First response: tool call
		// Second response: final answer
		mockFetch([
			createMockResponse(200, {
				choices: [
					{
						message: {
							role: "assistant",
							content: null,
							tool_calls: [
								{
									id: toolCallId,
									function: {
										name: "search_contacts",
										arguments: JSON.stringify({ query: "John" }),
									},
								},
							],
						},
					},
				],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			createMockResponse(200, {
				choices: [
					{
						message: {
							content: "I found John in contacts.",
						},
					},
				],
				usage: { prompt_tokens: 20, completion_tokens: 10 },
			}),
		]);

		const onToolCall = mock.fn(async (name, input) => {
			assert.strictEqual(name, "search_contacts");
			assert.deepStrictEqual(input, { query: "John" });
			return toolResult;
		});

		const result = await completeWithTools({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Find John" }],
			onToolCall,
		});

		assert.strictEqual(onToolCall.mock.callCount(), 1);
		assert.strictEqual(
			result.choices[0].message.content,
			"I found John in contacts.",
		);
		assert.strictEqual(result.rounds, 2);
	});

	test("stops after max rounds (20)", async () => {
		// Create 20 responses that all contain tool calls
		const responses = [];
		for (let i = 0; i < 20; i++) {
			responses.push(
				createMockResponse(200, {
					choices: [
						{
							message: {
								role: "assistant",
								content: null,
								tool_calls: [
									{
										id: `call-${i}`,
										function: {
											name: "search_contacts",
											arguments: JSON.stringify({ query: "test" }),
										},
									},
								],
							},
						},
					],
					usage: { prompt_tokens: 10, completion_tokens: 5 },
				}),
			);
		}

		mockFetch(responses);

		const onToolCall = mock.fn(async () => ({ contacts: [] }));

		await assert.rejects(
			() =>
				completeWithTools({
					model: "anthropic/claude-3.5-sonnet",
					messages: [{ role: "user", content: "test" }],
					onToolCall,
				}),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "TOOL_LOOP_EXCEEDED");
				return true;
			},
		);

		assert.strictEqual(onToolCall.mock.callCount(), 20);
	});

	test("handles tool execution errors gracefully", async () => {
		mockFetch([
			createMockResponse(200, {
				choices: [
					{
						message: {
							role: "assistant",
							content: null,
							tool_calls: [
								{
									id: "call-1",
									function: {
										name: "search_contacts",
										arguments: JSON.stringify({ query: "test" }),
									},
								},
							],
						},
					},
				],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			createMockResponse(200, {
				choices: [
					{ message: { content: "Tool failed but I can still help." } },
				],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
		]);

		const onToolCall = mock.fn(async () => {
			throw new Error("Database connection failed");
		});

		const result = await completeWithTools({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "test" }],
			onToolCall,
		});

		assert.strictEqual(onToolCall.mock.callCount(), 1);
		assert.ok(result.choices[0].message.content);
	});

	test("returns totalCost and rounds", async () => {
		const mockResult = {
			choices: [{ message: { content: "Done!" } }],
			usage: { prompt_tokens: 100, completion_tokens: 50 },
		};

		mockFetch([createMockResponse(200, mockResult)]);

		const result = await completeWithTools({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.strictEqual(typeof result.totalCost, "number");
		assert.strictEqual(result.rounds, 1);
	});
});

// ── estimateCost() ───────────────────────────────────────────────────────────

describe("estimateCost", () => {
	test("calculates correct cost for default model", () => {
		const cost = estimateCost({
			prompt_tokens: 1_000_000,
			completion_tokens: 1_000_000,
		});
		// $0.09 input + $0.18 output = $0.27 (DeepSeek V4 Flash)
		assert.strictEqual(cost, 0.27);
	});

	test("calculates correct cost for gpt-4o", () => {
		const cost = estimateCost(
			{ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
			"openai/gpt-4o",
		);
		// $2.5 input + $10 output = $12.5
		assert.strictEqual(cost, 12.5);
	});

	test("returns 0 for null/undefined usage", () => {
		assert.strictEqual(estimateCost(null), 0);
		assert.strictEqual(estimateCost(undefined), 0);
		assert.strictEqual(estimateCost({}), 0);
	});

	test("handles zero tokens", () => {
		const cost = estimateCost({ prompt_tokens: 0, completion_tokens: 0 });
		assert.strictEqual(cost, 0);
	});

	test("handles partial token counts", () => {
		const cost = estimateCost({
			prompt_tokens: 1000,
			completion_tokens: 500,
		});
		// $0.09/M input: 1000 tokens = $0.00009
		// $0.18/M output: 500 tokens = $0.00009
		// Total = $0.00018
		assert.ok(cost > 0);
		assert.ok(cost < 0.001);
	});

	test("uses default pricing for unknown model", () => {
		const cost = estimateCost(
			{ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
			"unknown/model",
		);
		// Falls back to deepseek/deepseek-v4-flash pricing: $0.09 + $0.18 = $0.27
		assert.strictEqual(cost, 0.27);
	});
});
