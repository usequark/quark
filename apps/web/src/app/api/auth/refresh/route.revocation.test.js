/**
 * Refresh-token revocation, against a real database.
 *
 * `route.test.js` pins the branching with a stubbed query layer. These are the
 * tests the security review asked for: they write actual `User` rows and issue
 * real signed refresh tokens, so the behaviour under test is the thing that
 * matters — a 30-day mobile refresh token must not outlive a password reset or a
 * role demotion.
 *
 * Named `*.test.js` rather than `*.integration.test.js` on purpose:
 * `apps/web/package.json` excludes every `*.integration.test.js` (that tier is
 * the server-driven suite), so a `*.integration.test.js` here would never run.
 * This suite needs Postgres, exactly as `packages/db`'s integration suite does.
 *
 * Run: node --test apps/web/src/app/api/auth/refresh/route.revocation.test.js
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { after, afterEach, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { prisma, user } from "@usequark/quark-db";
import { issueTokenPair, verifyMobileToken } from "../../../../lib/jwt.js";
import { POST } from "./route.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// refresh → auth → api → app → src → web → apps → repo root.
const repoRoot = path.resolve(__dirname, "../../../../../../..");
const dbPackageRoot = path.resolve(repoRoot, "packages/db");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const TEST_PREFIX = "refresh-revocation-";

function loadTestEnvironment() {
	try {
		process.loadEnvFile(path.join(repoRoot, ".env"));
	} catch {}

	process.env.POSTGRES_HOST ||= "localhost";
	process.env.POSTGRES_PORT ||= "5432";
	process.env.POSTGRES_USER ||= "quark_user";
	process.env.POSTGRES_PASSWORD ||= "CHANGE_ME_IN_ENV_FILE";
	process.env.POSTGRES_DB ||= "quark_dev";
	// Both `issueTokenPair` and `verifyMobileToken` need a signing secret.
	process.env.NEXTAUTH_SECRET ||= "refresh-revocation-test-secret";
}

async function schemaIsPresent() {
	const rows = await prisma.$queryRawUnsafe(
		"SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User'",
	);
	return rows.length > 0;
}

/** Poll for the `User` table, so a concurrent schema push can win first. */
async function waitForSchema(timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (await schemaIsPresent()) return true;
		if (Date.now() >= deadline) return false;
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
}

/**
 * Ensure the schema exists before any row is written.
 *
 * `packages/db`'s integration suite pushes the same schema and turbo may start
 * the two suites at the same moment; a push here would race it into an
 * "already exists" failure. So that suite gets first refusal, and this one
 * pushes only when nothing created the table (this file run on its own). A
 * losing push is retried by re-checking the table, never treated as fatal.
 */
async function ensureSchema() {
	if (await waitForSchema(10_000)) return;

	try {
		execFileSync(pnpmCommand, ["exec", "prisma", "db", "push"], {
			cwd: dbPackageRoot,
			encoding: "utf8",
			stdio: "pipe",
		});
	} catch (error) {
		if (await waitForSchema(5_000)) return;
		const detail = error.stderr || error.stdout || error.message;
		throw new Error(`Failed to prepare test database schema: ${detail}`);
	}
}

function uniqueEmail(label) {
	return `${TEST_PREFIX}${label}-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}@example.com`;
}

/** A `User` row, as the mobile token pair is minted from it. */
async function createAccount(overrides = {}) {
	return prisma.user.create({
		data: {
			email: uniqueEmail("account"),
			name: "Refresh Revocation User",
			role: "admin",
			...overrides,
		},
	});
}

function toTokenUser(account) {
	return {
		id: account.id,
		email: account.email,
		name: account.name,
		role: account.role,
	};
}

function refreshRequest(refreshToken) {
	return new Request("http://localhost/api/auth/refresh", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ refreshToken }),
	});
}

async function cleanupTestData() {
	await prisma.user.deleteMany({
		where: { email: { contains: TEST_PREFIX } },
	});
}

before(async () => {
	loadTestEnvironment();
	await ensureSchema();
	await cleanupTestData();
});

afterEach(async () => {
	await cleanupTestData();
});

after(async () => {
	await cleanupTestData();
	await prisma.$disconnect();
});

describe("POST /api/auth/refresh revocation (real database)", () => {
	test("a password reset kills a live mobile refresh token", async () => {
		const account = await createAccount({ password: "hash-before-reset" });
		const { refreshToken } = await issueTokenPair(toTokenUser(account));

		// Live before the reset: the same token the client is holding exchanges
		// for an access token.
		const beforeReset = await POST(refreshRequest(refreshToken));
		assert.strictEqual(
			beforeReset.status,
			200,
			"the refresh token should work before the password is reset",
		);

		// Exactly what `POST /api/auth/reset-password` writes.
		await user.update(account.id, {
			password: "hash-after-reset",
			passwordChangedAt: new Date(),
		});

		const response = await POST(refreshRequest(refreshToken));
		const body = await response.json();

		assert.strictEqual(
			response.status,
			401,
			"a token issued before the reset still refreshed after it",
		);
		assert.strictEqual(body.message, "Invalid or expired refresh token");
		assert.ok(
			!Object.hasOwn(body, "token"),
			"no access token may be issued for a dead refresh token",
		);
	});

	test("a role demotion kills the admin authority on a live mobile refresh token", async () => {
		const account = await createAccount({ role: "admin" });
		const { refreshToken } = await issueTokenPair(toTokenUser(account));

		// Positive control: while the row says admin, the exchange mints admin.
		const asAdmin = await POST(refreshRequest(refreshToken));
		assert.strictEqual(asAdmin.status, 200);
		const adminPayload = await verifyMobileToken((await asAdmin.json()).token);
		assert.strictEqual(adminPayload.role, "admin");

		// The demotion: what an authorization change writes to the row.
		await user.update(account.id, { role: "viewer" });

		const response = await POST(refreshRequest(refreshToken));
		const body = await response.json();

		assert.strictEqual(
			response.status,
			200,
			"a demoted user is still a user and may keep refreshing",
		);
		const payload = await verifyMobileToken(body.token);
		assert.strictEqual(
			payload.role,
			"viewer",
			"the old admin claim was re-stamped onto a fresh access token",
		);
		assert.strictEqual(payload.sub, account.id);
		assert.strictEqual(payload.email, account.email);
	});

	test("a deleted account cannot refresh", async () => {
		const account = await createAccount();
		const { refreshToken } = await issueTokenPair(toTokenUser(account));

		await user.delete(account.id);

		const response = await POST(refreshRequest(refreshToken));

		assert.strictEqual(response.status, 401);
	});

	test("profile changes are re-derived, not copied from the token", async () => {
		const account = await createAccount();
		const { refreshToken } = await issueTokenPair(toTokenUser(account));

		const newEmail = uniqueEmail("renamed");
		await user.update(account.id, { email: newEmail, name: "Renamed User" });

		const response = await POST(refreshRequest(refreshToken));
		const body = await response.json();

		assert.strictEqual(response.status, 200);
		const payload = await verifyMobileToken(body.token);
		assert.strictEqual(payload.email, newEmail);
		assert.strictEqual(payload.name, "Renamed User");
	});
});
