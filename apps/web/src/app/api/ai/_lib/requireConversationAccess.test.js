import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { ForbiddenError, NotFoundError } from "@techstream/quark-core/errors";

// ── Mocks ────────────────────────────────────────────────────────────────────

let originalPrisma;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	delete globalThis.__prisma;
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	mock.restoreAll();
});

function setPrismaMock(prismaMock) {
	globalThis.__prisma = prismaMock;
	return prismaMock;
}

function createMockSession(user) {
	return { user };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("requireConversationAccess", () => {
	test("returns conversation for owner", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-1",
			deletedAt: null,
			messages: [],
		};

		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
			},
		});

		const { requireConversationAccess } = await import(
			"./requireConversationAccess.js"
		);
		const session = createMockSession({ id: "user-1", role: "viewer" });

		const result = await requireConversationAccess("conv-1", session);
		assert.deepStrictEqual(result, mockConversation);
	});

	test("allows admin access to any conversation", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-other",
			deletedAt: null,
			messages: [],
		};

		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
			},
		});

		const { requireConversationAccess } = await import(
			"./requireConversationAccess.js"
		);
		const session = createMockSession({ id: "admin-1", role: "admin" });

		const result = await requireConversationAccess("conv-1", session);
		assert.deepStrictEqual(result, mockConversation);
	});

	test("allows lead_dev access to any conversation", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-other",
			deletedAt: null,
			messages: [],
		};

		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
			},
		});

		const { requireConversationAccess } = await import(
			"./requireConversationAccess.js"
		);
		const session = createMockSession({ id: "lead-1", role: "lead_dev" });

		const result = await requireConversationAccess("conv-1", session);
		assert.deepStrictEqual(result, mockConversation);
	});

	test("denies regular user access to other's conversation", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-other",
			deletedAt: null,
			messages: [],
		};

		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
			},
		});

		const { requireConversationAccess } = await import(
			"./requireConversationAccess.js"
		);
		const session = createMockSession({ id: "user-1", role: "viewer" });

		await assert.rejects(
			() => requireConversationAccess("conv-1", session),
			(error) => {
				assert.ok(error instanceof ForbiddenError);
				assert.strictEqual(error.statusCode, 403);
				return true;
			},
		);
	});

	test("returns 404 for non-existent conversation", async () => {
		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => null),
			},
		});

		const { requireConversationAccess } = await import(
			"./requireConversationAccess.js"
		);
		const session = createMockSession({ id: "user-1", role: "admin" });

		await assert.rejects(
			() => requireConversationAccess("nonexistent", session),
			(error) => {
				assert.ok(error instanceof NotFoundError);
				assert.strictEqual(error.statusCode, 404);
				return true;
			},
		);
	});

	test("returns 404 for soft-deleted conversation", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-1",
			deletedAt: new Date(),
			messages: [],
		};

		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
			},
		});

		const { requireConversationAccess } = await import(
			"./requireConversationAccess.js"
		);
		const session = createMockSession({ id: "user-1", role: "admin" });

		await assert.rejects(
			() => requireConversationAccess("conv-1", session),
			(error) => {
				assert.ok(error instanceof NotFoundError);
				return true;
			},
		);
	});

	test("includes messages in returned conversation", async () => {
		const mockConversation = {
			id: "conv-1",
			title: "Test",
			userId: "user-1",
			deletedAt: null,
			messages: [
				{ id: "msg-1", role: "user", content: "Hello" },
				{ id: "msg-2", role: "assistant", content: "Hi there!" },
			],
		};

		setPrismaMock({
			aiConversation: {
				findUnique: mock.fn(async () => mockConversation),
			},
		});

		const { requireConversationAccess } = await import(
			"./requireConversationAccess.js"
		);
		const session = createMockSession({ id: "user-1", role: "viewer" });

		const result = await requireConversationAccess("conv-1", session);
		assert.strictEqual(result.messages.length, 2);
		assert.strictEqual(result.messages[0].content, "Hello");
	});
});
