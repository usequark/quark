import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { after, afterEach, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { prisma } from "./client.js";
import {
	account,
	auditLog,
	file,
	session,
	user,
	verificationToken,
} from "./queries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const TEST_PREFIX = "queries-int-";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function loadTestEnvironment() {
	try {
		process.loadEnvFile(path.join(repoRoot, ".env"));
	} catch {}

	process.env.POSTGRES_HOST ||= "localhost";
	process.env.POSTGRES_PORT ||= "5432";
	process.env.POSTGRES_USER ||= "quark_user";
	process.env.POSTGRES_PASSWORD ||= "CHANGE_ME_IN_ENV_FILE";
	process.env.POSTGRES_DB ||= "quark_dev";
}

function ensureSchema() {
	try {
		execFileSync(pnpmCommand, ["exec", "prisma", "db", "push"], {
			cwd: packageRoot,
			encoding: "utf8",
			stdio: "pipe",
		});
	} catch (error) {
		const detail = error.stderr || error.stdout || error.message;
		throw new Error(`Failed to prepare test database schema: ${detail}`);
	}
}

function uniqueId(label) {
	return `${TEST_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanupTestData() {
	await prisma.account.deleteMany({
		where: { providerAccountId: { contains: TEST_PREFIX } },
	});
	await prisma.session.deleteMany({
		where: { sessionToken: { contains: TEST_PREFIX } },
	});
	await prisma.file.deleteMany({
		where: { storageKey: { contains: TEST_PREFIX } },
	});
	await prisma.auditLog.deleteMany({
		where: { entityId: { contains: TEST_PREFIX } },
	});
	await prisma.verificationToken.deleteMany({
		where: { identifier: { contains: TEST_PREFIX } },
	});
	await prisma.user.deleteMany({
		where: { email: { contains: TEST_PREFIX } },
	});
}

before(async () => {
	loadTestEnvironment();
	ensureSchema();
	await prisma.$connect();
	await cleanupTestData();
});

afterEach(async () => {
	await cleanupTestData();
});

after(async () => {
	await cleanupTestData();
	await prisma.$disconnect();
});

describe("queries integration", () => {
	test("user.findById returns the safe user projection while findByEmail returns the password", async () => {
		const id = uniqueId("user");
		const email = `${id}@example.com`;
		const createdUser = await prisma.user.create({
			data: {
				email,
				name: "Integration User",
				password: `${id}-password`,
				role: "admin",
			},
		});

		const safeUser = await user.findById(createdUser.id);
		assert.ok(safeUser);
		assert.equal(safeUser.email, email);
		assert.equal(safeUser.role, "admin");
		assert.ok(!Object.hasOwn(safeUser, "password"));

		const authUser = await user.findByEmail(email);
		assert.ok(authUser);
		assert.equal(authUser.password, `${id}-password`);
	});

	test("account.findByUserIdAndProvider returns the matching provider account", async () => {
		const id = uniqueId("account");
		const createdUser = await prisma.user.create({
			data: {
				email: `${id}@example.com`,
				name: "Account User",
				role: "viewer",
			},
		});

		await prisma.account.create({
			data: {
				userId: createdUser.id,
				type: "oauth",
				provider: "github",
				providerAccountId: `${id}-github`,
			},
		});

		const result = await account.findByUserIdAndProvider(
			createdUser.id,
			"github",
		);

		assert.ok(result);
		assert.equal(result.provider, "github");
		assert.equal(result.providerAccountId, `${id}-github`);
	});

	test("session.findByToken includes the safe user projection", async () => {
		const id = uniqueId("session");
		const createdUser = await prisma.user.create({
			data: {
				email: `${id}@example.com`,
				name: "Session User",
				password: `${id}-password`,
				role: "editor",
			},
		});

		await prisma.session.create({
			data: {
				sessionToken: `${id}-token`,
				userId: createdUser.id,
				expires: new Date(Date.now() + 60_000),
			},
		});

		const result = await session.findByToken(`${id}-token`);

		assert.ok(result);
		assert.equal(result.user.email, `${id}@example.com`);
		assert.ok(!Object.hasOwn(result.user, "password"));
	});

	test("verificationToken.findByIdentifierAndToken uses the compound key", async () => {
		const id = uniqueId("verify");
		await prisma.verificationToken.create({
			data: {
				identifier: `${id}@example.com`,
				token: `${id}-token`,
				expires: new Date(Date.now() + 60_000),
			},
		});

		const result = await verificationToken.findByIdentifierAndToken(
			`${id}@example.com`,
			`${id}-token`,
		);

		assert.ok(result);
		assert.equal(result.identifier, `${id}@example.com`);
		assert.equal(result.token, `${id}-token`);
	});

	test("auditLog.findByEntity orders matching records newest first and includes the user projection", async () => {
		const id = uniqueId("audit");
		const createdUser = await prisma.user.create({
			data: {
				email: `${id}@example.com`,
				name: "Audit User",
				role: "viewer",
			},
		});

		await prisma.auditLog.create({
			data: {
				userId: createdUser.id,
				action: "CREATE",
				entity: "Page",
				entityId: `${id}-older`,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
		});
		await prisma.auditLog.create({
			data: {
				userId: createdUser.id,
				action: "UPDATE",
				entity: "Page",
				entityId: `${id}-newer`,
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
			},
		});

		const results = await auditLog.findByEntity("Page", { take: 10 });
		const matching = results.filter((entry) => entry.entityId.startsWith(id));

		assert.equal(matching.length, 2);
		assert.equal(matching[0].entityId, `${id}-newer`);
		assert.equal(matching[1].entityId, `${id}-older`);
		assert.equal(matching[0].user.email, `${id}@example.com`);
	});

	test("file.findOlderThan returns only orphaned files older than the cutoff", async () => {
		const id = uniqueId("file");
		const owner = await prisma.user.create({
			data: {
				email: `${id}@example.com`,
				name: "File Owner",
				role: "viewer",
			},
		});

		await prisma.file.create({
			data: {
				filename: `${id}-old.txt`,
				originalName: `${id}-old.txt`,
				mimeType: "text/plain",
				size: 1,
				storageKey: `${id}/old.txt`,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
		});
		await prisma.file.create({
			data: {
				filename: `${id}-recent.txt`,
				originalName: `${id}-recent.txt`,
				mimeType: "text/plain",
				size: 1,
				storageKey: `${id}/recent.txt`,
				createdAt: new Date("2026-03-01T00:00:00.000Z"),
			},
		});
		await prisma.file.create({
			data: {
				filename: `${id}-owned.txt`,
				originalName: `${id}-owned.txt`,
				mimeType: "text/plain",
				size: 1,
				storageKey: `${id}/owned.txt`,
				uploadedById: owner.id,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
		});

		const result = await file.findOlderThan(
			new Date("2026-02-01T00:00:00.000Z"),
			{
				take: 10,
			},
		);

		const matching = result.filter((entry) => entry.storageKey.startsWith(id));
		assert.deepStrictEqual(
			matching.map((entry) => entry.storageKey),
			[`${id}/old.txt`],
		);
	});

	test("deleting a user preserves their audit records and keeps the actor named", async () => {
		// The referential action is enforced by Postgres, not by the query layer, so
		// this has to run against a real database. With `onDelete: Cascade` this
		// delete destroyed every record of what the user did — including the records
		// of the deletion itself.
		const id = uniqueId("audit-preserve");
		const actor = await prisma.user.create({
			data: { email: `${id}@example.com`, name: "Actor", role: "admin" },
		});

		const record = await auditLog.create({
			userId: actor.id,
			action: "DELETE",
			entity: "User",
			entityId: `${id}-target`,
		});

		// What DELETE /api/users/[id] does.
		await user.delete(actor.id);

		const surviving = await prisma.auditLog.findUnique({
			where: { id: record.id },
		});
		assert.ok(surviving, "the audit record was destroyed with its actor");
		assert.equal(
			surviving.userId,
			null,
			"userId should be nulled, not cascaded",
		);
		// Without the snapshot the record would name nobody.
		assert.equal(surviving.actorEmail, `${id}@example.com`);

		// Reads must tolerate the nulled relation rather than throwing.
		const listed = await auditLog.findAll({ take: 50 });
		const found = listed.find((entry) => entry.id === record.id);
		assert.ok(found);
		assert.equal(found.user, null);
		assert.equal(found.actorEmail, `${id}@example.com`);
	});

	test("the audit foreign key still rejects an actor that does not exist", async () => {
		// SetNull only relaxes the delete side. A write naming a user that is not
		// there must still be refused, or the snapshot helper would be resolving
		// emails for ids that never existed.
		const id = uniqueId("audit-fk");

		await assert.rejects(
			() =>
				prisma.auditLog.create({
					data: {
						userId: `${id}-no-such-user`,
						action: "CREATE",
						entity: "User",
						entityId: `${id}-target`,
					},
				}),
			/ForeignKey|Foreign key|violates/,
		);
	});
});
