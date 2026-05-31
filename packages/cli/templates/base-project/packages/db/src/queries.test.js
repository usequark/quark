import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import {
	account,
	auditLog,
	file,
	session,
	USER_SAFE_SELECT,
	user,
	verificationToken,
} from "./queries.js";

let originalPrisma;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	delete globalThis.__prisma;
});

afterEach(() => {
	if (originalPrisma === undefined) {
		delete globalThis.__prisma;
	} else {
		globalThis.__prisma = originalPrisma;
	}
	mock.restoreAll();
});

function setPrismaMock(prismaMock) {
	globalThis.__prisma = prismaMock;
	return prismaMock;
}

test("user.findById uses safe select fields", async () => {
	const prismaMock = setPrismaMock({
		user: {
			findUnique: mock.fn(async (args) => args),
		},
	});

	const result = await user.findById("user-1");

	assert.deepStrictEqual(result, {
		where: { id: "user-1" },
		select: USER_SAFE_SELECT,
	});
	assert.strictEqual(prismaMock.user.findUnique.mock.callCount(), 1);
});

test("user.findByEmail requests the full internal record", async () => {
	const prismaMock = setPrismaMock({
		user: {
			findUnique: mock.fn(async (args) => args),
		},
	});

	const result = await user.findByEmail("admin@example.com");

	assert.deepStrictEqual(result, {
		where: { email: "admin@example.com" },
	});
	assert.strictEqual(prismaMock.user.findUnique.mock.callCount(), 1);
});

test("user.findAll applies pagination, safe select, and default ordering", async () => {
	const prismaMock = setPrismaMock({
		user: {
			findMany: mock.fn(async (args) => args),
		},
	});

	const result = await user.findAll({ skip: 5, take: 20 });

	assert.deepStrictEqual(result, {
		skip: 5,
		take: 20,
		select: USER_SAFE_SELECT,
		orderBy: { createdAt: "desc" },
	});
	assert.strictEqual(prismaMock.user.findMany.mock.callCount(), 1);
});

test("account.findByUserIdAndProvider uses a composite lookup", async () => {
	const prismaMock = setPrismaMock({
		account: {
			findFirst: mock.fn(async (args) => args),
		},
	});

	const result = await account.findByUserIdAndProvider("user-1", "github");

	assert.deepStrictEqual(result, {
		where: { userId: "user-1", provider: "github" },
	});
	assert.strictEqual(prismaMock.account.findFirst.mock.callCount(), 1);
});

test("session.findByToken includes the safe user projection", async () => {
	const prismaMock = setPrismaMock({
		session: {
			findUnique: mock.fn(async (args) => args),
		},
	});

	const result = await session.findByToken("session-token");

	assert.deepStrictEqual(result, {
		where: { sessionToken: "session-token" },
		include: { user: { select: USER_SAFE_SELECT } },
	});
	assert.strictEqual(prismaMock.session.findUnique.mock.callCount(), 1);
});

test("verificationToken.findByIdentifierAndToken uses the compound key", async () => {
	const prismaMock = setPrismaMock({
		verificationToken: {
			findUnique: mock.fn(async (args) => args),
		},
	});

	const result = await verificationToken.findByIdentifierAndToken(
		"person@example.com",
		"token-123",
	);

	assert.deepStrictEqual(result, {
		where: {
			identifier_token: {
				identifier: "person@example.com",
				token: "token-123",
			},
		},
	});
	assert.strictEqual(
		prismaMock.verificationToken.findUnique.mock.callCount(),
		1,
	);
});

test("auditLog.findByEntity keeps include and ordering defaults", async () => {
	const prismaMock = setPrismaMock({
		auditLog: {
			findMany: mock.fn(async (args) => args),
		},
	});

	const result = await auditLog.findByEntity("Page", { skip: 2, take: 15 });

	assert.deepStrictEqual(result, {
		where: { entity: "Page" },
		skip: 2,
		take: 15,
		include: { user: { select: { id: true, email: true, name: true } } },
		orderBy: { createdAt: "desc" },
	});
	assert.strictEqual(prismaMock.auditLog.findMany.mock.callCount(), 1);
});

test("file.findOlderThan scopes to orphaned files before a cutoff", async () => {
	const cutoff = new Date("2026-01-01T00:00:00.000Z");
	const prismaMock = setPrismaMock({
		file: {
			findMany: mock.fn(async (args) => args),
		},
	});

	const result = await file.findOlderThan(cutoff, { take: 25 });

	assert.deepStrictEqual(result, {
		where: {
			uploadedById: null,
			createdAt: { lt: cutoff },
		},
		take: 25,
		orderBy: { createdAt: "asc" },
	});
	assert.strictEqual(prismaMock.file.findMany.mock.callCount(), 1);
});
