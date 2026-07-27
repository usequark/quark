import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { UnauthorizedError } from "@techstream/quark-core/errors";

// Resolve @/ alias used by route files
register(new URL("../../../../scripts/test-alias-loader.mjs", import.meta.url));

// ── Auth mock with swappable implementations ─────────────────────────────────

const authMiddlewareUrl = pathToFileURL(
	new URL("../../../lib/auth-middleware.js", import.meta.url).pathname,
).href;

let requireAuthImpl = async () => ({
	user: { id: "admin-1", role: "admin", email: "admin@example.com" },
});
let requireRoleImpl = async () => ({
	user: { id: "admin-1", role: "admin", email: "admin@example.com" },
});

mock.module(authMiddlewareUrl, {
	namedExports: {
		requireAuth: (...args) => requireAuthImpl(...args),
		requireRole: (...args) => requireRoleImpl(...args),
	},
});

// ── Prisma mock helpers ─────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────────────

test("GET /api/users returns list for admin", async () => {
	requireAuthImpl = async () => ({
		user: { id: "admin-1", role: "admin", email: "admin@example.com" },
	});
	requireRoleImpl = async () => ({
		user: { id: "admin-1", role: "admin", email: "admin@example.com" },
	});

	setPrismaMock({
		user: {
			findMany: mock.fn(async () => [
				{ id: "user-1", name: "Alice", email: "alice@example.com" },
				{ id: "user-2", name: "Bob", email: "bob@example.com" },
			]),
			count: mock.fn(async () => 2),
		},
	});

	const { GET } = await import("./route.js");
	const response = await GET(new Request("http://localhost/api/users"));
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.ok(body.data);
	assert.ok(Array.isArray(body.data));
	assert.strictEqual(body.data.length, 2);
	assert.ok(body.pagination);
});

test("GET /api/users returns 403 when not admin", async () => {
	requireRoleImpl = async () => {
		throw new UnauthorizedError("Forbidden");
	};

	const { GET } = await import("./route.js");
	const response = await GET(new Request("http://localhost/api/users"));

	assert.strictEqual(response.status, 401);
});
