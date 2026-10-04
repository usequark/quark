import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { UnauthorizedError } from "@usequark/quark-core/errors";

// Resolve @/ alias used by route files
register(new URL("../../../../scripts/test-alias-loader.mjs", import.meta.url));

// ── Auth mock with swappable implementations ─────────────────────────────────

const authMiddlewareUrl = pathToFileURL(
	new URL("../../../lib/auth-middleware.js", import.meta.url).pathname,
).href;

let requireAuthImpl = async () => ({
	user: { id: "user-1", role: "user", email: "user@example.com" },
});
const requireRoleImpl = async () => ({
	user: { id: "user-1", role: "admin", email: "user@example.com" },
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

test("GET /api/files returns list for authenticated user", async () => {
	requireAuthImpl = async () => ({
		user: { id: "user-1", role: "user", email: "user@example.com" },
	});

	setPrismaMock({
		file: {
			findMany: mock.fn(async () => [
				{
					id: "file-1",
					originalName: "report.pdf",
					mimeType: "application/pdf",
					size: 1024,
					createdAt: new Date("2024-06-01T12:00:00.000Z"),
				},
			]),
		},
	});

	const { GET } = await import("./route.js");
	const response = await GET(new Request("http://localhost/api/files"));
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.ok(Array.isArray(body));
	assert.strictEqual(body.length, 1);
});

test("GET /api/files returns 401 when unauthenticated", async () => {
	requireAuthImpl = async () => {
		throw new UnauthorizedError(
			"You must be logged in to access this resource",
		);
	};

	const { GET } = await import("./route.js");
	const response = await GET(new Request("http://localhost/api/files"));
	const _body = await response.json();

	assert.strictEqual(response.status, 401);
});
