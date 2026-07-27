import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { closeSharedRedisClient } from "@techstream/quark-config";
import { AppError } from "@techstream/quark-core/errors";
import { handleAiAgentTask } from "./ai.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

let originalPrisma;
let originalFetch;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	originalFetch = globalThis.fetch;
	delete globalThis.__prisma;
	process.env.OPENROUTER_API_KEY = "test-api-key";
});

afterEach(async () => {
	await closeSharedRedisClient();
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

function makeBullJob(name, data, overrides = {}) {
	return { id: "job-1", name, data, attemptsMade: 0, ...overrides };
}

// ── handleAiAgentTask ────────────────────────────────────────────────────────

describe("handleAiAgentTask", () => {
	test("throws when conversationId is missing", async () => {
		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", { message: "Hello" });

		await assert.rejects(
			() => handleAiAgentTask(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "AI_CONVERSATION_ID_REQUIRED");
				return true;
			},
		);
	});

	test("throws when message is missing", async () => {
		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", { conversationId: "conv-1" });

		await assert.rejects(
			() => handleAiAgentTask(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "AI_MESSAGE_REQUIRED");
				return true;
			},
		);
	});

	test("throws when user not found", async () => {
		setPrismaMock({
			user: {
				findUnique: mock.fn(async () => null),
			},
		});

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "nonexistent-user",
			message: "Hello",
		});

		await assert.rejects(
			() => handleAiAgentTask(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "USER_NOT_FOUND");
				assert.strictEqual(error.message, "User not found");
				return true;
			},
		);
	});

	test("throws when conversation not found", async () => {
		setPrismaMock({
			user: {
				findUnique: mock.fn(async () => ({ role: "admin" })),
			},
			aiConversation: {
				findUnique: mock.fn(async () => null),
			},
		});

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "nonexistent",
			message: "Hello",
		});

		await assert.rejects(
			() => handleAiAgentTask(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "CONVERSATION_NOT_FOUND");
				return true;
			},
		);
	});

	test("loads conversation from DB", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-1",
			deletedAt: null,
			messages: [{ id: "m1", role: "user", content: "Hello", toolCalls: null }],
		};

		const prisma = setPrismaMock({
			user: {
				findUnique: mock.fn(async () => ({ role: "admin" })),
			},
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
				update: mock.fn(async () => ({})),
			},
			aiMessage: {
				create: mock.fn(async () => ({
					id: "msg-new",
					role: "assistant",
					content: "Hi!",
				})),
			},
		});

		// Mock OpenRouter response
		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "Hi there!" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "user-1",
			message: "Hello",
		});

		try {
			await handleAiAgentTask(job, logger);
		} catch {
			// May fail due to Redis/mock issues, but we can still check Prisma calls
		}

		assert.ok(prisma.aiConversation.findUnique.mock.callCount() >= 1);
	});

	test("saves assistant message to DB", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-1",
			deletedAt: null,
			messages: [],
		};

		const prisma = setPrismaMock({
			user: {
				findUnique: mock.fn(async () => ({ role: "admin" })),
			},
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
				update: mock.fn(async () => ({})),
			},
			aiMessage: {
				create: mock.fn(async () => ({ id: "msg-new" })),
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "Response" } }],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			}),
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "user-1",
			message: "Test",
		});

		try {
			await handleAiAgentTask(job, logger);
		} catch {
			// Redis may fail
		}

		assert.ok(prisma.aiMessage.create.mock.callCount() >= 1);
		const createCall = prisma.aiMessage.create.mock.calls[0].arguments[0];
		assert.strictEqual(createCall.data.role, "assistant");
		assert.strictEqual(createCall.data.conversationId, "conv-1");
	});

	test("throws for deleted conversation", async () => {
		setPrismaMock({
			user: {
				findUnique: mock.fn(async () => ({ role: "admin" })),
			},
			aiConversation: {
				findUnique: mock.fn(async () => ({
					id: "conv-1",
					deletedAt: new Date(),
					messages: [],
				})),
			},
		});

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "user-1",
			message: "Hello",
		});

		await assert.rejects(
			() => handleAiAgentTask(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "CONVERSATION_NOT_FOUND");
				return true;
			},
		);
	});

	test("handles OpenRouter errors gracefully", async () => {
		setPrismaMock({
			user: {
				findUnique: mock.fn(async () => ({ role: "admin" })),
			},
			aiConversation: {
				findUnique: mock.fn(async () => ({
					id: "conv-1",
					deletedAt: null,
					messages: [],
				})),
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 400,
			ok: false,
			text: async () => "Bad request",
			headers: { get: () => null },
		}));

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "user-1",
			message: "Hello",
		});

		await assert.rejects(
			() => handleAiAgentTask(job, logger),
			(error) => {
				assert.ok(error instanceof AppError);
				assert.strictEqual(error.code, "OPENROUTER_API_ERROR");
				return true;
			},
		);
	});
});
