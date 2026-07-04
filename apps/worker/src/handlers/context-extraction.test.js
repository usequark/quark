import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { AppError } from "@techstream/quark-core/errors";
import { handleContextExtraction } from "./context-extraction.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

let originalPrisma;
let originalFetch;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	originalFetch = globalThis.fetch;
	delete globalThis.__prisma;
	process.env.OPENROUTER_API_KEY = "test-api-key";
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	globalThis.fetch = originalFetch;
	mock.restoreAll();
});

function setPrismaMock(prismaMock) {
	globalThis.__prisma = prismaMock;
	return prismaMock;
}

function createMockLogger() {
	return {
		info: mock.fn(),
		warn: mock.fn(),
		error: mock.fn(),
	};
}

function makeBullJob(data, overrides = {}) {
	return {
		id: "job-1",
		name: "context-extraction",
		data,
		attemptsMade: 0,
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("handleContextExtraction", () => {
	test("throws when conversationId is missing", async () => {
		const logger = createMockLogger();
		const job = makeBullJob({});

		await assert.rejects(
			() => handleContextExtraction(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(
					error.code,
					"CONTEXT_EXTRACTION_CONVERSATION_ID_REQUIRED",
				);
				return true;
			},
		);
	});

	test("returns empty when no messages found", async () => {
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => []),
			},
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.deepStrictEqual(result, { extracted: 0, contexts: [] });
	});

	test("loads messages from DB via conversationId", async () => {
		const mockMessages = [
			{ id: "m1", role: "user", content: "We work with Acme Corp" },
			{ id: "m2", role: "assistant", content: "Got it, Acme Corp is a client" },
		];

		const prisma = setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => mockMessages),
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "[]" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		await handleContextExtraction(job, logger);

		assert.strictEqual(prisma.aiMessage.findMany.mock.callCount(), 1);
		const callArgs = prisma.aiMessage.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.conversationId, "conv-1");
	});

	test("calls OpenRouter for extraction", async () => {
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => [
					{ id: "m1", role: "user", content: "Test message" },
				]),
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "[]" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		await handleContextExtraction(job, logger);

		assert.strictEqual(globalThis.fetch.mock.callCount(), 1);
		const callArgs = globalThis.fetch.mock.calls[0].arguments;
		const body = JSON.parse(callArgs[1].body);
		assert.strictEqual(body.model, "anthropic/claude-3.5-sonnet");
		assert.ok(body.messages.length >= 2);
	});

	test("parses extracted contexts correctly", async () => {
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => [
					{ id: "m1", role: "user", content: "We work with Acme Corp in tech" },
				]),
			},
		});

		const extractedContexts = [
			{
				key: "client.acme.industry",
				value: "Technology",
				category: "client",
				source: "learned",
			},
		];

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: JSON.stringify(extractedContexts) } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.extracted, 1);
		assert.strictEqual(result.contexts.length, 1);
		assert.strictEqual(result.contexts[0].key, "client.acme.industry");
	});

	test("handles extraction errors gracefully", async () => {
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => [
					{ id: "m1", role: "user", content: "Test" },
				]),
			},
		});

		globalThis.fetch = mock.fn(async () => {
			throw new Error("OpenRouter API error");
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		await assert.rejects(
			() => handleContextExtraction(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "CONTEXT_EXTRACTION_FAILED");
				return true;
			},
		);
	});

	test("handles invalid JSON response from OpenRouter", async () => {
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => [
					{ id: "m1", role: "user", content: "Test" },
				]),
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "This is not JSON" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.extracted, 0);
		assert.strictEqual(result.error, "Failed to parse extraction result");
	});

	test("preserves seed source tag in extracted contexts", async () => {
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => [
					{ id: "m1", role: "user", content: "Test" },
				]),
			},
		});

		const extractedContexts = [
			{
				key: "client.acme",
				value: "Acme Corp",
				category: "client",
				source: "seed",
			},
		];

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: JSON.stringify(extractedContexts) } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.contexts[0].source, "seed");
	});

	test("returns 0 extracted for empty array response", async () => {
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => [
					{ id: "m1", role: "user", content: "Just chatting" },
				]),
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "[]" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.extracted, 0);
		assert.deepStrictEqual(result.contexts, []);
	});
});
