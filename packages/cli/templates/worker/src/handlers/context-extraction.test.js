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

function createMockConversation(messages) {
	return {
		id: "conv-1",
		title: "Test session",
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		summary: null,
		summaryTokens: null,
		summaryUpdatedAt: null,
		messages: messages.map((m, i) => ({
			id: m.id || `m${i + 1}`,
			role: m.role,
			content: m.content,
			createdAt: new Date(),
			conversationId: "conv-1",
			toolCalls: null,
			cost: null,
			tokens: null,
		})),
	};
}

function createMockFetch(responseData) {
	return mock.fn(async () => ({
		status: 200,
		ok: true,
		json: async () => responseData,
		text: async () => JSON.stringify(responseData),
		headers: { get: () => null },
	}));
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
			aiConversation: {
				findUnique: mock.fn(async () => createMockConversation([])),
			},
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.deepStrictEqual(result, { extracted: 0, contexts: [] });
	});

	test("loads conversation from DB via conversationId", async () => {
		const mockMessages = [
			{ id: "m1", role: "user", content: "We work with Acme Corp" },
			{ id: "m2", role: "assistant", content: "Got it, Acme Corp is a client" },
		];

		const prisma = setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => createMockConversation(mockMessages)),
			},
		});

		globalThis.fetch = createMockFetch({
			choices: [{ message: { content: "[]" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		await handleContextExtraction(job, logger);

		assert.strictEqual(prisma.aiConversation.findUnique.mock.callCount(), 1);
		const callArgs =
			prisma.aiConversation.findUnique.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.id, "conv-1");
	});

	test("calls OpenRouter for extraction", async () => {
		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () =>
					createMockConversation([{ role: "user", content: "Test message" }]),
				),
			},
		});

		globalThis.fetch = createMockFetch({
			choices: [{ message: { content: "[]" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		await handleContextExtraction(job, logger);

		assert.strictEqual(globalThis.fetch.mock.callCount(), 1);
		const callArgs = globalThis.fetch.mock.calls[0].arguments;
		const body = JSON.parse(callArgs[1].body);
		assert.strictEqual(body.model, "deepseek/deepseek-v4-flash");
		assert.strictEqual(body.messages.length, 1);
	});

	test("parses extracted contexts and saves to DB", async () => {
		const mockSavedContext = {
			id: "ctx-1",
			key: "client.acme.industry",
			value: "Technology",
			category: "client",
			source: "ai",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const prisma = setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () =>
					createMockConversation([
						{ role: "user", content: "We work with Acme Corp in tech" },
					]),
				),
			},
			context: {
				upsert: mock.fn(async () => mockSavedContext),
			},
		});

		const extractedContexts = [
			{
				key: "client.acme.industry",
				value: "Technology",
				category: "client",
			},
		];

		globalThis.fetch = createMockFetch({
			choices: [{ message: { content: JSON.stringify(extractedContexts) } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.extracted, 1);
		assert.strictEqual(result.contexts.length, 1);
		assert.strictEqual(result.contexts[0].key, "client.acme.industry");
		assert.strictEqual(prisma.context.upsert.mock.callCount(), 1);
	});

	test("handles extraction errors gracefully", async () => {
		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () =>
					createMockConversation([{ role: "user", content: "Test" }]),
				),
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
			aiConversation: {
				findUnique: mock.fn(async () =>
					createMockConversation([{ role: "user", content: "Test" }]),
				),
			},
		});

		globalThis.fetch = createMockFetch({
			choices: [{ message: { content: "This is not JSON" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.extracted, 0);
		assert.deepStrictEqual(result.contexts, []);
	});

	test("sets source to ai for extracted contexts", async () => {
		const mockSavedContext = {
			id: "ctx-1",
			key: "client.acme",
			value: "Acme Corp",
			category: "client",
			source: "ai",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const prisma = setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () =>
					createMockConversation([{ role: "user", content: "Test" }]),
				),
			},
			context: {
				upsert: mock.fn(async () => mockSavedContext),
			},
		});

		const extractedContexts = [
			{
				key: "client.acme",
				value: "Acme Corp",
				category: "client",
			},
		];

		globalThis.fetch = createMockFetch({
			choices: [{ message: { content: JSON.stringify(extractedContexts) } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.contexts[0].source, "ai");
		assert.strictEqual(prisma.context.upsert.mock.callCount(), 1);
	});

	test("returns 0 extracted for empty array response", async () => {
		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () =>
					createMockConversation([{ role: "user", content: "Just chatting" }]),
				),
			},
		});

		globalThis.fetch = createMockFetch({
			choices: [{ message: { content: "[]" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		const result = await handleContextExtraction(job, logger);
		assert.strictEqual(result.extracted, 0);
		assert.deepStrictEqual(result.contexts, []);
	});

	test("upserts context records to DB", async () => {
		const mockSavedContext = {
			id: "ctx-1",
			key: "client.acme.industry",
			value: "Technology",
			category: "client",
			source: "ai",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const prisma = setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () =>
					createMockConversation([
						{ role: "user", content: "We work with Acme Corp in tech" },
					]),
				),
			},
			context: {
				upsert: mock.fn(async () => mockSavedContext),
			},
		});

		const extractedContexts = [
			{
				key: "client.acme.industry",
				value: "Technology",
				category: "client",
			},
		];

		globalThis.fetch = createMockFetch({
			choices: [{ message: { content: JSON.stringify(extractedContexts) } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const logger = createMockLogger();
		const job = makeBullJob({ conversationId: "conv-1" });

		await handleContextExtraction(job, logger);

		assert.strictEqual(prisma.context.upsert.mock.callCount(), 1);
		const upsertArgs = prisma.context.upsert.mock.calls[0].arguments[0];
		assert.strictEqual(
			upsertArgs.where.key_category.key,
			"client.acme.industry",
		);
		assert.strictEqual(upsertArgs.where.key_category.category, "client");
		assert.strictEqual(upsertArgs.create.key, "client.acme.industry");
		assert.strictEqual(upsertArgs.create.value, "Technology");
	});
});
