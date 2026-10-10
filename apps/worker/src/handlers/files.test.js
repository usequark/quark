import assert from "node:assert";
import { beforeEach, mock, test } from "node:test";

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before the handler is imported, so the handler
// picks up the stubs. `import()` is cached, so a later `mock.module` would not
// reach bindings the handler already holds.

/** Operation log, so tests can assert on ordering as well as outcomes. */
let calls = [];

/** Rows `file.findOlderThan` returns. */
let orphanedRows;
/** Row count reported per id by `file.deleteIfPresent`. */
let deleteCounts;
/** When set, `deleteIfPresent` rejects with this error for this id. */
let deleteErrorFor;

/** A logger that swallows output but records the calls a test may assert on. */
const logRecords = { info: [], warn: [] };
const testLogger = {
	info: (msg, meta) => logRecords.info.push({ msg, meta }),
	warn: (msg, meta) => logRecords.warn.push({ msg, meta }),
	error: () => {},
	debug: () => {},
	fatal: () => {},
};

mock.module("@usequark/quark-core/storage", {
	namedExports: {
		createStorage: () => ({
			provider: "local",
			put: async () => {},
			delete: async (key) => {
				calls.push(`storage.delete:${key}`);
			},
		}),
	},
});

mock.module("@usequark/quark-db", {
	namedExports: {
		file: {
			findOlderThan: async () => orphanedRows,
			deleteIfPresent: async (id) => {
				if (deleteErrorFor === id) throw new Error("db exploded");
				calls.push(`db.delete:${id}`);
				return { count: deleteCounts[id] ?? 1 };
			},
		},
	},
});

const { handleCleanupOrphanedFiles } = await import("./files.js");

/** A BullMQ-shaped job carrying only the fields the handler reads. */
function job(retentionHours = 24) {
	return { data: { retentionHours } };
}

function row(id) {
	return { id, storageKey: `uploads/2026/02/${id}.png`, uploadedById: null };
}

beforeEach(() => {
	calls = [];
	logRecords.info = [];
	logRecords.warn = [];
	orphanedRows = [row("a"), row("b")];
	deleteCounts = {};
	deleteErrorFor = null;
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("cleanup deletes the row before the storage object", async () => {
	const result = await handleCleanupOrphanedFiles(job(), testLogger);

	assert.strictEqual(result.deleted, 2);

	// For each record the row delete must precede the blob delete. Storage-first
	// destroys the only copy of the bytes before the row delete is attempted, so a
	// failed row delete leaves a row pointing at an object that no longer exists.
	for (const id of ["a", "b"]) {
		const rowIndex = calls.indexOf(`db.delete:${id}`);
		const storageIndex = calls.indexOf(
			`storage.delete:uploads/2026/02/${id}.png`,
		);
		assert.ok(rowIndex !== -1, `row ${id} was never deleted`);
		assert.ok(storageIndex !== -1, `blob for ${id} was never deleted`);
		assert.ok(
			rowIndex < storageIndex,
			`row ${id} must be deleted before its blob, got: ${calls.join(" -> ")}`,
		);
	}
});

test("cleanup does not remove a blob when the row delete fails", async () => {
	deleteErrorFor = "a";

	const result = await handleCleanupOrphanedFiles(job(), testLogger);

	assert.strictEqual(result.deleted, 1);
	assert.ok(
		!calls.includes("storage.delete:uploads/2026/02/a.png"),
		`blob for the failed row was destroyed anyway: ${calls.join(", ")}`,
	);
	assert.strictEqual(result.errors.length, 1);
	assert.strictEqual(result.errors[0].id, "a");
});

test("cleanup skips the blob when a concurrent delete already took the row", async () => {
	deleteCounts = { a: 0 };

	const result = await handleCleanupOrphanedFiles(job(), testLogger);

	// count 0 means someone else removed the row and owns the blob cleanup.
	// Deleting it here would race that request.
	assert.strictEqual(result.deleted, 1);
	assert.ok(
		!calls.includes("storage.delete:uploads/2026/02/a.png"),
		`blob for the already-deleted row was touched: ${calls.join(", ")}`,
	);
});

test("cleanup is a no-op when nothing is orphaned", async () => {
	orphanedRows = [];

	const result = await handleCleanupOrphanedFiles(job(), testLogger);

	assert.deepStrictEqual(result, { success: true, deleted: 0 });
	assert.deepStrictEqual(calls, []);
});

test("cleanup reports per-file errors without aborting the run", async () => {
	deleteErrorFor = "a";
	orphanedRows = [row("a"), row("b"), row("c")];

	const result = await handleCleanupOrphanedFiles(job(), testLogger);

	// One failure must not stop the remaining files from being swept.
	assert.strictEqual(result.total, 3);
	assert.strictEqual(result.deleted, 2);
	assert.strictEqual(result.errors.length, 1);
});
