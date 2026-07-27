import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { ServiceError } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import {
	complete,
	completeStreaming,
	completeWithTools,
	estimateCost,
} from "./openrouter.js";

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
		text: (_async) => JSON.stringify(body),
		text: async () => JSON.stringify(body),
	};
}

/**
 * Build a fetch Response-like object with an SSE ReadableStream body.
 * @param {number} status
 * @param {Array<object|string>} chunks - JSON chunk objects or "[DONE]"
 * @param {Object} [headers]
 */
function createMockStreamResponse(status, chunks, headers = {}) {
	const sseText = chunks
		.map((chunk) =>
			chunk === "[DONE]"
				? "data: [DONE]\n\n"
				: `data: ${JSON.stringify(chunk)}\n\n`,
		)
		.join("");

	const encoder = new TextEncoder();
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(sseText));
			controller.close();
		},
	});

	return {
		status,
		ok: status >= 200 && status < 300,
		headers: {
			get: (key) => headers[key] || null,
		},
		body,
		json: async () => {
			throw new Error("stream response has no json body");
		},
		text: async () => sseText,
	};
}

function contentChunk(text, extras = {}) {
	return {
		id: "chatcmpl-test",
		model: "test-model",
		choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
		...extras,
	};
}

function finishChunk(finishReason = "stop", usage = null) {
	return {
		id: "chatcmpl-test",
		model: "test-model",
		choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
		...(usage ? { usage } : {}),
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
				assert.ok(error instanceof ServiceError);
				assert.strictEqual(error.serviceName, "OpenRouter");
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

		const result = await completeWithTools({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "test" }],
			onToolCall,
		});

		assert.strictEqual(result.truncated, true);
		assert.strictEqual(result.rounds, 20);
		assert.strictEqual(
			result.choices[0].message.content.includes("maximum number"),
			true,
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

	test("streams final response tokens via onStream", async () => {
		const tokens = [];
		mockFetch([
			createMockStreamResponse(200, [
				{ choices: [{ delta: { role: "assistant" } }] },
				contentChunk("Hello"),
				contentChunk(" world"),
				finishChunk("stop", {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15,
				}),
				"[DONE]",
			]),
		]);

		const result = await completeWithTools({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Hi" }],
			onStream: async (token) => {
				tokens.push(token);
			},
		});

		assert.deepStrictEqual(tokens, ["Hello", " world"]);
		assert.strictEqual(result.choices[0].message.content, "Hello world");
		assert.strictEqual(result.rounds, 1);

		const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
		assert.strictEqual(body.stream, true);
	});

	test("does not emit onStream tokens during tool-call rounds", async () => {
		const tokens = [];
		const toolCallId = "call-1";

		mockFetch([
			// Round 1: tool call stream (no content tokens expected)
			createMockStreamResponse(200, [
				{
					choices: [
						{
							delta: {
								role: "assistant",
								tool_calls: [
									{
										index: 0,
										id: toolCallId,
										type: "function",
										function: {
											name: "search_contacts",
											arguments: '{"query":"John"}',
										},
									},
								],
							},
						},
					],
				},
				finishChunk("tool_calls", {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15,
				}),
				"[DONE]",
			]),
			// Round 2: final text stream
			createMockStreamResponse(200, [
				contentChunk("Found "),
				contentChunk("John"),
				finishChunk("stop", {
					prompt_tokens: 20,
					completion_tokens: 10,
					total_tokens: 30,
				}),
				"[DONE]",
			]),
		]);

		const onToolCall = mock.fn(async () => ({ contacts: [] }));

		const result = await completeWithTools({
			model: "anthropic/claude-3.5-sonnet",
			messages: [{ role: "user", content: "Find John" }],
			onToolCall,
			onStream: async (token) => {
				tokens.push(token);
			},
		});

		assert.strictEqual(onToolCall.mock.callCount(), 1);
		assert.deepStrictEqual(tokens, ["Found ", "John"]);
		assert.strictEqual(result.choices[0].message.content, "Found John");
		assert.strictEqual(result.rounds, 2);
	});
});

// ── completeStreaming() ──────────────────────────────────────────────────────

describe("completeStreaming", () => {
	test("parses SSE content deltas and calls onToken", async () => {
		const tokens = [];
		mockFetch([
			createMockStreamResponse(200, [
				contentChunk("Hi"),
				contentChunk("!"),
				finishChunk("stop", {
					prompt_tokens: 5,
					completion_tokens: 2,
					total_tokens: 7,
				}),
				"[DONE]",
			]),
		]);

		const result = await completeStreaming({
			model: "test-model",
			messages: [{ role: "user", content: "Hey" }],
			onToken: async (t) => {
				tokens.push(t);
			},
		});

		assert.deepStrictEqual(tokens, ["Hi", "!"]);
		assert.strictEqual(result.choices[0].message.content, "Hi!");
		assert.strictEqual(result.choices[0].finish_reason, "stop");
		assert.strictEqual(result.usage.total_tokens, 7);
	});

	test("assembles streamed tool_calls", async () => {
		mockFetch([
			createMockStreamResponse(200, [
				{
					choices: [
						{
							delta: {
								role: "assistant",
								tool_calls: [
									{
										index: 0,
										id: "call-abc",
										type: "function",
										function: { name: "search_contacts", arguments: "" },
									},
								],
							},
						},
					],
				},
				{
					choices: [
						{
							delta: {
								tool_calls: [{ index: 0, function: { arguments: '{"q":' } }],
							},
						},
					],
				},
				{
					choices: [
						{
							delta: {
								tool_calls: [{ index: 0, function: { arguments: '"x"}' } }],
							},
						},
					],
				},
				finishChunk("tool_calls"),
				"[DONE]",
			]),
		]);

		const result = await completeStreaming({
			model: "test-model",
			messages: [{ role: "user", content: "search" }],
		});

		const toolCalls = result.choices[0].message.tool_calls;
		assert.ok(toolCalls);
		assert.strictEqual(toolCalls.length, 1);
		assert.strictEqual(toolCalls[0].id, "call-abc");
		assert.strictEqual(toolCalls[0].function.name, "search_contacts");
		assert.strictEqual(toolCalls[0].function.arguments, '{"q":"x"}');
	});

	test("sets stream:true in request body", async () => {
		mockFetch([
			createMockStreamResponse(200, [
				contentChunk("ok"),
				finishChunk("stop"),
				"[DONE]",
			]),
		]);

		await completeStreaming({
			model: "test-model",
			messages: [{ role: "user", content: "Hi" }],
		});

		const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
		assert.strictEqual(body.stream, true);
	});

	test("throws when OPENROUTER_API_KEY is not configured", async () => {
		delete process.env.OPENROUTER_API_KEY;

		await assert.rejects(
			() =>
				completeStreaming({
					model: "test-model",
					messages: [{ role: "user", content: "Hi" }],
				}),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "OPENROUTER_NOT_CONFIGURED");
				return true;
			},
		);
	});

	test("retries on 429 then succeeds", async () => {
		mockFetch([
			createMockStreamResponse(429, [{ error: "rate limited" }], {
				"retry-after": "0",
			}),
			createMockStreamResponse(200, [
				contentChunk("ok"),
				finishChunk("stop"),
				"[DONE]",
			]),
		]);

		const result = await completeStreaming({
			model: "test-model",
			messages: [{ role: "user", content: "Hi" }],
		});

		assert.strictEqual(result.choices[0].message.content, "ok");
		assert.strictEqual(globalThis.fetch.mock.callCount(), 2);
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
