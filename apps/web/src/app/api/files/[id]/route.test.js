import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files
// `[id]/` is 5 levels below apps/web (files → api → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds.

// Auth mock with a swappable implementation
// `[id]/` is 5 levels below apps/web (files → api → app → src → web), so
// `src/lib/` is 3 levels up from here.
const authMiddlewareUrl = pathToFileURL(
	new URL("../../../../lib/auth-middleware.js", import.meta.url).pathname,
).href;

let requireAuthImpl = async () => ({
	user: { id: "user-1", role: "user", email: "user@example.com" },
});

mock.module(authMiddlewareUrl, {
	namedExports: {
		requireAuth: (...args) => requireAuthImpl(...args),
	},
});

// Storage mock. `storageCalls` records the order of every storage operation so
// the tests can assert that the row is deleted *before* the blob is removed.
let storageCalls = [];
let storageDeleteImpl = async () => {};

const core = await import("@usequark/quark-core");

mock.module("@usequark/quark-core", {
	namedExports: {
		...core,
		createLogger: () => ({
			info() {},
			error() {},
			warn() {},
			debug() {},
		}),
		createStorage: () => ({
			provider: "local",
			put: async () => {},
			delete: async (key) => {
				storageCalls.push(`storage.delete:${key}`);
				return storageDeleteImpl(key);
			},
		}),
	},
});

// ── Database mock ────────────────────────────────────────────────────────────
//
// `file.findById` / `file.deleteIfPresent` are driven through the global Prisma
// stub, matching how packages/db/src/queries.js reaches the client.

let originalPrisma;

/** The File row `findById` returns. */
let fileRecord;
/** The row count `deleteMany` reports — 0 simulates a concurrent delete. */
let deleteCount;
/** When set, `deleteMany` rejects with this error instead. */
let deleteError;

function setPrismaMock() {
	globalThis.__prisma = {
		file: {
			findUnique: mock.fn(async () => fileRecord ?? null),
			deleteMany: mock.fn(async () => {
				if (deleteError) throw deleteError;
				storageCalls.push("db.delete");
				return { count: deleteCount };
			}),
		},
	};
}

const UPLOAD = {
	id: "file-1",
	filename: "report.pdf",
	originalName: "report.pdf",
	mimeType: "application/pdf",
	size: 1024,
	storageKey: "uploads/2026/02/abc-report.pdf",
	storageProvider: "local",
	uploadedById: "user-1",
};

function resetFixtures() {
	storageCalls = [];
	storageDeleteImpl = async () => {};
	fileRecord = { ...UPLOAD };
	deleteCount = 1;
	deleteError = null;
}

const { DELETE } = await import("./route.js");

/** A CSRF-bearing DELETE request, as `withCsrfProtection` requires. */
function deleteRequest(id = "file-1") {
	return new Request(`http://localhost/api/files/${id}`, {
		method: "DELETE",
		headers: {
			cookie: "csrf_token=test-csrf-token",
			"x-csrf-token": "test-csrf-token",
		},
	});
}

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	resetFixtures();
	setPrismaMock();
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("DELETE /api/files/[id] deletes the row then the storage object", async () => {
	const response = await DELETE(deleteRequest(), { params: { id: "file-1" } });
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.message, "File deleted");
	assert.deepStrictEqual(storageCalls, [
		"db.delete",
		"storage.delete:uploads/2026/02/abc-report.pdf",
	]);
});

test("DELETE deletes the row before removing the bytes", async () => {
	// The ordering is the fix. Storage-first destroys the only copy of the bytes
	// before the row delete is attempted, so a refused row delete leaves a row
	// pointing at an object that no longer exists — unrecoverable, because the
	// blob was the only copy.
	await DELETE(deleteRequest(), { params: { id: "file-1" } });

	const dbIndex = storageCalls.indexOf("db.delete");
	const storageIndex = storageCalls.findIndex((c) =>
		c.startsWith("storage.delete:"),
	);

	assert.ok(dbIndex !== -1, "row was never deleted");
	assert.ok(storageIndex !== -1, "storage object was never deleted");
	assert.ok(
		dbIndex < storageIndex,
		`row must be deleted before the blob, got: ${storageCalls.join(" -> ")}`,
	);
});

test("DELETE returns 409 and keeps the bytes when a foreign key refuses the row", async () => {
	// What happens once File gains an incoming relation with restrictive onDelete.
	// The blob must survive: the storage delete is gated behind the row delete.
	deleteError = Object.assign(new Error("Foreign key constraint failed"), {
		code: "P2003",
	});

	const response = await DELETE(deleteRequest(), { params: { id: "file-1" } });

	assert.strictEqual(response.status, 409);
	assert.ok(
		!storageCalls.some((c) => c.startsWith("storage.delete:")),
		`blob was destroyed despite the refused row delete: ${storageCalls.join(", ")}`,
	);
});

test("DELETE returns 404 and leaves storage alone when a concurrent delete won", async () => {
	// Two overlapping requests both pass the ownership check. deleteMany reports
	// count 0 for the loser, which must not also delete the blob — the winner owns
	// that step and may not have run it yet.
	deleteCount = 0;

	const response = await DELETE(deleteRequest(), { params: { id: "file-1" } });

	assert.strictEqual(response.status, 404);
	assert.deepStrictEqual(storageCalls, ["db.delete"]);
});

test("DELETE returns 404 when the file does not exist", async () => {
	fileRecord = null;

	const response = await DELETE(deleteRequest(), { params: { id: "nope" } });

	assert.strictEqual(response.status, 404);
	assert.deepStrictEqual(storageCalls, []);
});

test("DELETE returns 403 for a user who is neither uploader nor admin", async () => {
	fileRecord = { ...UPLOAD, uploadedById: "someone-else" };

	const response = await DELETE(deleteRequest(), { params: { id: "file-1" } });

	assert.strictEqual(response.status, 403);
	// Authorization runs before anything is destroyed.
	assert.deepStrictEqual(storageCalls, []);
});

test("DELETE allows an admin to delete another user's file", async () => {
	requireAuthImpl = async () => ({
		user: { id: "admin-1", role: "admin", email: "admin@example.com" },
	});
	fileRecord = { ...UPLOAD, uploadedById: "someone-else" };

	const response = await DELETE(deleteRequest(), { params: { id: "file-1" } });

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(storageCalls, [
		"db.delete",
		"storage.delete:uploads/2026/02/abc-report.pdf",
	]);
});

test("DELETE still reports success when the storage cleanup fails", async () => {
	// The row is already gone, so the delete did succeed as far as the caller is
	// concerned. Returning 500 would be a failure they cannot act on, and would
	// leave an orphaned blob for the cleanup job to sweep either way.
	storageDeleteImpl = async () => {
		throw new Error("EACCES: permission denied");
	};

	const response = await DELETE(deleteRequest(), { params: { id: "file-1" } });
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.message, "File deleted");
});

test("DELETE does not swallow a database failure", async () => {
	deleteError = new Error("connection terminated unexpectedly");

	const response = await DELETE(deleteRequest(), { params: { id: "file-1" } });

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(storageCalls, []);
});
