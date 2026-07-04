import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { summarizeConversation } from "./summarize.js";

let originalFetch;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	process.env.OPENROUTER_API_KEY = "test-api-key";
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	mock.restoreAll();
});

describe("summarizeConversation", () => {
	test("returns empty for empty messages", async () => {
		const result = await summarizeConversation([]);
		assert.deepStrictEqual(result, { summary: "", tokenCount: 0 });
	});

	test("returns empty for null messages", async () => {
		const result = await summarizeConversation(null);
		assert.deepStrictEqual(result, { summary: "", tokenCount: 0 });
	});

	test("calls complete with correct prompt", async () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
		];

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "User greeted assistant" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			}),
			headers: { get: () => null },
		}));

		const result = await summarizeConversation(messages);

		assert.strictEqual(result.summary, "User greeted assistant");
		assert.ok(result.tokenCount > 0);

		// Verify fetch was called
		assert.ok(globalThis.fetch.mock.callCount() >= 1);
		const fetchCall = globalThis.fetch.mock.calls[0].arguments;
		const body = JSON.parse(fetchCall[1].body);
		assert.strictEqual(body.model, "deepseek/deepseek-v4-flash");
		assert.ok(body.messages.length === 2); // system + user
		assert.ok(body.messages[0].content.includes("Summarize"));
	});

	test("handles errors gracefully", async () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
		];

		globalThis.fetch = mock.fn(async () => ({
			status: 400,
			ok: false,
			text: async () => "Bad request",
			headers: { get: () => null },
		}));

		const result = await summarizeConversation(messages);

		// Should return empty summary on error
		assert.deepStrictEqual(result, { summary: "", tokenCount: 0 });
	});

	test("returns summary with token count", async () => {
		const messages = [
			{ role: "user", content: "Tell me about the deal with Acme Corp" },
			{ role: "assistant", content: "The deal is worth $50k and closing soon" },
		];

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [
					{
						message: { content: "Discussion about Acme Corp deal worth $50k" },
					},
				],
				usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
			}),
			headers: { get: () => null },
		}));

		const result = await summarizeConversation(messages);

		assert.ok(result.summary.length > 0);
		assert.ok(result.tokenCount > 0);
	});

	test("formats tool messages correctly", async () => {
		const messages = [
			{ role: "user", content: "Search for contacts" },
			{
				role: "assistant",
				content: "",
				tool_calls: [{ function: { name: "search" } }],
			},
			{ role: "tool", content: JSON.stringify({ contacts: ["John", "Jane"] }) },
		];

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "User searched for contacts" } }],
				usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 },
			}),
			headers: { get: () => null },
		}));

		const result = await summarizeConversation(messages);

		assert.ok(result.summary.length > 0);
	});
});
