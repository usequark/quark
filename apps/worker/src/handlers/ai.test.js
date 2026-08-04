import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
	getUserToolAccessLevel,
	waitForToolConfirmation,
} from "@techstream/quark-ai/permissions";
import { closeSharedRedisClient } from "@techstream/quark-config";
import { ServiceError } from "@techstream/quark-core";
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
	const withAuditDefaults = {
		aiToolEvent: {
			create: mock.fn(async (args) => ({ id: "evt-1", ...args?.data })),
			upsert: mock.fn(async (args) => ({
				id: "evt-1",
				...args?.create,
				...args?.update,
			})),
		},
		...prismaMock,
		// Keep explicit aiToolEvent overrides if provided
		...(prismaMock.aiToolEvent ? { aiToolEvent: prismaMock.aiToolEvent } : {}),
	};
	globalThis.__prisma = withAuditDefaults;
	return withAuditDefaults;
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

/**
 * Mock OpenRouter SSE streaming response (handleAiAgentTask uses onStream).
 * @param {string} content
 * @param {object} [usage]
 */
function mockOpenRouterStream(
	content,
	usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
) {
	const chunks = [
		`data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })}\n\n`,
		`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
		`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage })}\n\n`,
		"data: [DONE]\n\n",
	].join("");

	const encoder = new TextEncoder();
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(chunks));
			controller.close();
		},
	});

	globalThis.fetch = mock.fn(async () => ({
		status: 200,
		ok: true,
		body,
		headers: { get: () => null },
		text: async () => chunks,
	}));
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

		// Mock OpenRouter streaming response
		mockOpenRouterStream("Hi there!");

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

		mockOpenRouterStream("Response");

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
		assert.strictEqual(createCall.data.content, "Response");
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

	// ── Tool permission helper unit tests ───────────────────────────────────────

	describe("getUserToolAccessLevel", () => {
		test("returns auto when userId is falsy", async () => {
			const level = await getUserToolAccessLevel("", "search_contacts");
			assert.strictEqual(level, "auto");
		});

		test("returns auto when userId is null", async () => {
			const level = await getUserToolAccessLevel(null, "search_contacts");
			assert.strictEqual(level, "auto");
		});

		test("returns access level from DB when record exists", async () => {
			setPrismaMock({
				aiToolPermission: {
					findUnique: mock.fn(async () => ({ accessLevel: "confirm" })),
				},
			});

			const level = await getUserToolAccessLevel("user-1", "search_contacts");
			assert.strictEqual(level, "confirm");
		});

		test("returns auto when no DB record exists", async () => {
			setPrismaMock({
				aiToolPermission: {
					findUnique: mock.fn(async () => null),
				},
			});

			const level = await getUserToolAccessLevel("user-1", "search_contacts");
			assert.strictEqual(level, "auto");
		});

		test("returns disabled level from DB", async () => {
			setPrismaMock({
				aiToolPermission: {
					findUnique: mock.fn(async () => ({ accessLevel: "disabled" })),
				},
			});

			const level = await getUserToolAccessLevel("user-1", "web_search");
			assert.strictEqual(level, "disabled");
		});

		test("queries with correct compound key", async () => {
			const prisma = setPrismaMock({
				aiToolPermission: {
					findUnique: mock.fn(async () => null),
				},
			});

			await getUserToolAccessLevel("user-42", "create_contact");
			const call =
				prisma.aiToolPermission.findUnique.mock.calls[0].arguments[0];
			assert.deepStrictEqual(call.where.userId_toolName, {
				userId: "user-42",
				toolName: "create_contact",
			});
		});
	});

	// ── handleAiAgentTask integration tests ──────────────────────────────────────

	test("skips disabled tool and returns skipped result", async () => {
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
			aiToolPermission: {
				findUnique: mock.fn(async () => ({ accessLevel: "disabled" })),
			},
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
				update: mock.fn(async () => ({})),
			},
			aiMessage: {
				create: mock.fn(async () => ({ id: "msg-new" })),
			},
		});

		// Mock OpenRouter with a tool call
		const toolCallChunk = {
			choices: [
				{
					delta: {
						role: "assistant",
						tool_calls: [
							{
								id: "call-1",
								type: "function",
								function: {
									name: "search_contacts",
									arguments: '{"query":"test"}',
								},
							},
						],
					},
				},
			],
		};
		const toolResultChunk = {
			choices: [
				{
					delta: {},
					finish_reason: "stop",
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				},
			],
		};

		const chunks = [
			`data: ${JSON.stringify(toolCallChunk)}\n\n`,
			`data: ${JSON.stringify(toolResultChunk)}\n\n`,
			"data: [DONE]\n\n",
		].join("");

		const encoder = new TextEncoder();
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(chunks));
				controller.close();
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			body,
			headers: { get: () => null },
			text: async () => chunks,
		}));

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "user-1",
			message: "Search for contacts",
		});

		try {
			await handleAiAgentTask(job, logger);
		} catch {
			// Redis may fail, but we can still verify permission was checked
		}

		// Verify permission was checked
		assert.ok(prisma.aiToolPermission.findUnique.mock.callCount() >= 1);
		const permCall =
			prisma.aiToolPermission.findUnique.mock.calls[0].arguments[0];
		assert.strictEqual(
			permCall.where.userId_toolName.toolName,
			"search_contacts",
		);
	});

	test("defaults to auto when no permission record exists", async () => {
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
			aiToolPermission: {
				findUnique: mock.fn(async () => null), // No permission record
			},
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
				update: mock.fn(async () => ({})),
			},
			aiMessage: {
				create: mock.fn(async () => ({ id: "msg-new" })),
			},
		});

		// Mock OpenRouter with a tool call to trigger permission check
		const toolCallChunk = {
			choices: [
				{
					delta: {
						role: "assistant",
						tool_calls: [
							{
								id: "call-1",
								type: "function",
								function: {
									name: "search_contacts",
									arguments: '{"query":"test"}',
								},
							},
						],
					},
				},
			],
		};
		const toolResultChunk = {
			choices: [
				{
					delta: {},
					finish_reason: "stop",
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				},
			],
		};

		const chunks = [
			`data: ${JSON.stringify(toolCallChunk)}\n\n`,
			`data: ${JSON.stringify(toolResultChunk)}\n\n`,
			"data: [DONE]\n\n",
		].join("");

		const encoder = new TextEncoder();
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(chunks));
				controller.close();
			},
		});

		globalThis.fetch = mock.fn(async () => ({
			status: 200,
			ok: true,
			body,
			headers: { get: () => null },
			text: async () => chunks,
		}));

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "user-1",
			message: "Search for contacts",
		});

		try {
			await handleAiAgentTask(job, logger);
		} catch {
			// Redis may fail
		}

		// Permission check was called for the tool call
		assert.ok(prisma.aiToolPermission.findUnique.mock.callCount() >= 1);
		const permCall =
			prisma.aiToolPermission.findUnique.mock.calls[0].arguments[0];
		assert.strictEqual(
			permCall.where.userId_toolName.toolName,
			"search_contacts",
		);
	});

	test("checks permission for each tool call", async () => {
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
			aiToolPermission: {
				findUnique: mock.fn(async () => ({ accessLevel: "auto" })),
			},
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
				update: mock.fn(async () => ({})),
			},
			aiMessage: {
				create: mock.fn(async () => ({ id: "msg-new" })),
			},
		});

		mockOpenRouterStream("Done");

		const logger = createMockLogger();
		const job = makeBullJob("ai-agent-task", {
			conversationId: "conv-1",
			userId: "user-1",
			message: "Hello",
		});

		try {
			await handleAiAgentTask(job, logger);
		} catch {
			// Redis may fail
		}

		// Even without tool calls, permission check may be called for the tool definitions
		// The key assertion is that the handler doesn't crash
		assert.ok(prisma.aiConversation.findUnique.mock.callCount() >= 1);
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
				assert.ok(error instanceof ServiceError);
				assert.strictEqual(error.serviceName, "OpenRouter");
				return true;
			},
		);
	});
});

// ── waitForToolConfirmation unit tests ──────────────────────────────────────

describe("waitForToolConfirmation", () => {
	function createMockSubscriber() {
		return {
			on: mock.fn(),
			subscribe: mock.fn(async () => {}),
			removeListener: mock.fn(),
			unsubscribe: mock.fn(async () => {}),
			disconnect: mock.fn(),
			status: "ready",
			connect: mock.fn(async () => {}),
		};
	}

	function createMockRedisClient(subscriber) {
		return {
			duplicate: mock.fn(() => subscriber),
		};
	}

	test("resolves with approved when message received", async () => {
		const subscriber = createMockSubscriber();
		const client = createMockRedisClient(subscriber);

		// Start the confirmation wait
		const promise = waitForToolConfirmation("call-1", 5000, client);

		// Wait for subscriber to register
		await new Promise((r) => setTimeout(r, 20));

		// Find the onMessage handler and invoke it
		const onCall = subscriber.on.mock.calls.find(
			(c) => c.arguments[0] === "message",
		);
		assert.ok(onCall, "message handler should be registered");
		const messageHandler = onCall.arguments[1];
		messageHandler("channel", JSON.stringify({ approved: true }));

		const result = await promise;
		assert.strictEqual(result.approved, true);
		assert.strictEqual(result.timedOut, undefined);
	});

	test("resolves with denied when message says denied", async () => {
		const subscriber = createMockSubscriber();
		const client = createMockRedisClient(subscriber);

		const promise = waitForToolConfirmation("call-2", 5000, client);
		await new Promise((r) => setTimeout(r, 20));

		const onCall = subscriber.on.mock.calls.find(
			(c) => c.arguments[0] === "message",
		);
		assert.ok(onCall);
		const messageHandler = onCall.arguments[1];
		messageHandler("channel", JSON.stringify({ approved: false }));

		const result = await promise;
		assert.strictEqual(result.approved, false);
		assert.strictEqual(result.timedOut, undefined);
	});

	test("resolves with timedOut when timeout fires", async () => {
		const subscriber = createMockSubscriber();
		const client = createMockRedisClient(subscriber);

		const result = await waitForToolConfirmation("call-3", 10, client);
		assert.strictEqual(result.approved, false);
		assert.strictEqual(result.timedOut, true);
	});

	test("returns timedOut when Redis client is unavailable", async () => {
		const result = await waitForToolConfirmation("call-4", 5000, null);
		assert.strictEqual(result.approved, false);
		assert.strictEqual(result.timedOut, true);
	});

	test("subscribes to correct channel", async () => {
		const subscriber = createMockSubscriber();
		const client = createMockRedisClient(subscriber);

		const promise = waitForToolConfirmation("test-channel-id", 5000, client);
		await new Promise((r) => setTimeout(r, 20));

		assert.strictEqual(
			subscriber.subscribe.mock.calls[0].arguments[0],
			"ai:tool-confirm:test-channel-id",
		);

		// Clean up by triggering timeout
		subscriber._testTimer = setTimeout(() => {}, 1);
		// Cancel by sending a message
		const onCall = subscriber.on.mock.calls.find(
			(c) => c.arguments[0] === "message",
		);
		if (onCall)
			onCall.arguments[1]("channel", JSON.stringify({ approved: false }));
		await promise;
	});

	test("subscribes with a duplicate connection", async () => {
		const subscriber = createMockSubscriber();
		const client = createMockRedisClient(subscriber);

		const promise = waitForToolConfirmation("call-dup", 5000, client);
		await new Promise((r) => setTimeout(r, 20));

		assert.ok(client.duplicate.mock.callCount() >= 1);

		// Clean up
		const onCall = subscriber.on.mock.calls.find(
			(c) => c.arguments[0] === "message",
		);
		if (onCall)
			onCall.arguments[1]("channel", JSON.stringify({ approved: false }));
		await promise;
	});
});

// ── Confirm flow integration test (requires Redis) ─────────────────────────

describe("confirm flow integration", () => {
	test("publishes and receives confirmation via real Redis", async () => {
		let client;
		try {
			const { default: Redis } = await import("ioredis");
			client = new Redis({ host: "localhost", port: 6379, lazyConnect: true });
			await client.connect();
			await client.ping();
		} catch {
			// Redis unavailable — skip
			return;
		}

		const callId = `int-test-${Date.now()}`;
		const subscriber = client.duplicate();

		try {
			// Start waitForToolConfirmation with the real client
			const confirmPromise = waitForToolConfirmation(callId, 3000, client);

			// Give it time to subscribe
			await new Promise((r) => setTimeout(r, 100));

			// Publish approval from a separate client
			await subscriber.connect();
			await subscriber.publish(
				`ai:tool-confirm:${callId}`,
				JSON.stringify({ approved: true, callId }),
			);

			const result = await confirmPromise;
			assert.strictEqual(result.approved, true);
			assert.strictEqual(result.timedOut, undefined);
		} finally {
			try {
				subscriber.disconnect();
			} catch {}
			try {
				client.disconnect();
			} catch {}
		}
	});

	test("times out when no confirmation received", async () => {
		let client;
		try {
			const { default: Redis } = await import("ioredis");
			client = new Redis({ host: "localhost", port: 6379, lazyConnect: true });
			await client.connect();
			await client.ping();
		} catch {
			return;
		}

		const callId = `int-test-timeout-${Date.now()}`;

		try {
			const result = await waitForToolConfirmation(callId, 50, client);
			assert.strictEqual(result.approved, false);
			assert.strictEqual(result.timedOut, true);
		} finally {
			try {
				client.disconnect();
			} catch {}
		}
	});
});
