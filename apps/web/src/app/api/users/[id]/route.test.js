import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { ForbiddenError } from "@usequark/quark-core/errors";

// Resolve the @/ alias used by route files.
// `[id]/` is 5 levels below apps/web (users → api → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Auth mock ────────────────────────────────────────────────────────────────
//
// `mock.module` replaces the whole module, so both exports the route and its
// sibling might reach for are provided. Registered at module scope, before
// `./route.js` is imported — `import()` caches after the first call, so a later
// `mock.module` would not reach the bindings the route already holds.
//
// `requireRole` is swappable per test so the admin gate can be made to pass or
// fail without re-importing the route.

const authMiddlewareUrl = pathToFileURL(
	new URL("../../../../lib/auth-middleware.js", import.meta.url).pathname,
).href;

const ADMIN_SESSION = {
	user: { id: "admin-1", role: "admin", email: "admin@example.com" },
};

let requireRoleImpl = async () => ADMIN_SESSION;

mock.module(authMiddlewareUrl, {
	namedExports: {
		requireAuth: async () => ADMIN_SESSION,
		requireRole: (...args) => requireRoleImpl(...args),
	},
});

// ── Prisma mock ──────────────────────────────────────────────────────────────
//
// `user.findById` / `user.update` / `user.delete` in `@usequark/quark-db` all reach
// the client through the `globalThis.__prisma` stub, matching how
// `packages/db/src/client.js` resolves it.
//
// The four write paths are recorded separately rather than funnelled into one
// `calls` array, because the DELETE tests are about which writes happen at all,
// not just their order.

/** The row `findById` returns, or null for a miss. */
let userById;
/** The row `update` returns. */
let updatedRow;
/** When set, `update` rejects with this error instead. */
let updateError;
/** When set, `delete` rejects with this error instead. */
let deleteError;
/** Every write the route issued, as `method:id`, in order. */
let dbWrites = [];

let originalPrisma;

function setPrismaMock() {
	globalThis.__prisma = {
		user: {
			// `findById` selects USER_SAFE_SELECT, so `where.id` is the only key.
			findUnique: mock.fn(async ({ where }) =>
				where.id === KNOWN.id ? (userById ?? null) : null,
			),
			update: mock.fn(async ({ where, data }) => {
				if (updateError) throw updateError;
				dbWrites.push(`update:${where.id}`);
				return { ...(updatedRow ?? { ...KNOWN, ...data }) };
			}),
			// `user.delete` is `prisma.user.delete`, which throws P2025 when the row
			// is already gone. That is why the route checks `findById` first.
			delete: mock.fn(async ({ where }) => {
				if (deleteError) throw deleteError;
				dbWrites.push(`delete:${where.id}`);
				return { ...KNOWN };
			}),
		},
	};
}

const KNOWN = {
	id: "user-1",
	email: "alice@example.com",
	name: "Alice",
	role: "viewer",
};

function resetFixtures() {
	userById = { ...KNOWN };
	updatedRow = { ...KNOWN, name: "Alice Renamed" };
	updateError = null;
	deleteError = null;
	dbWrites = [];
	requireRoleImpl = async () => ADMIN_SESSION;
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

const { GET, PATCH, DELETE } = await import("./route.js");

/** Next.js resolves route params to a Promise; the route awaits it. */
function context(id = KNOWN.id) {
	return { params: Promise.resolve({ id }) };
}

function getRequest(id = KNOWN.id) {
	return new Request(`http://localhost/api/users/${id}`);
}

/** A CSRF-bearing mutating request, as `withCsrfProtection` requires. */
function mutatingRequest(method, id = KNOWN.id, body) {
	return new Request(`http://localhost/api/users/${id}`, {
		method,
		headers: {
			"content-type": "application/json",
			cookie: "csrf_token=test-csrf-token",
			"x-csrf-token": "test-csrf-token",
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

// ── GET ───────────────────────────────────────────────────────────────────────

test("GET /api/users/[id] returns the user for an admin", async () => {
	const response = await GET(getRequest(), context());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.id, KNOWN.id);
	assert.strictEqual(body.email, KNOWN.email);
});

test("GET returns 404 for an unknown id", async () => {
	userById = null;

	const response = await GET(getRequest("nope"), context("nope"));
	const body = await response.json();

	assert.strictEqual(response.status, 404);
	assert.strictEqual(body.message, "User not found");
});

test("GET returns 403 for a non-admin", async () => {
	requireRoleImpl = async () => {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	};

	const response = await GET(getRequest(), context());

	// `requireRole` throws ForbiddenError (403) for an authenticated non-admin and
	// UnauthorizedError (401) for no session at all. Asserting 403 here pins the
	// admin gate; the sibling users/route.test.js covers the 401 path.
	assert.strictEqual(response.status, 403);
});

test("GET checks authorization before touching the database", async () => {
	requireRoleImpl = async () => {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	};
	userById = null;

	await GET(getRequest(), context());

	// A non-admin must not be able to distinguish "exists" from "does not exist"
	// by status code, which is only true if the lookup never runs.
	assert.deepStrictEqual(dbWrites, []);
	assert.strictEqual(
		globalThis.__prisma.user.findUnique.mock.callCount(),
		0,
		"the existence check ran before authorization",
	);
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

test("PATCH /api/users/[id] updates through validateBody and user.update", async () => {
	const response = await PATCH(
		mutatingRequest("PATCH", KNOWN.id, { name: "Alice Renamed" }),
		context(),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.name, "Alice Renamed");
	assert.deepStrictEqual(dbWrites, [`update:${KNOWN.id}`]);
});

test("PATCH strips keys the schema does not allow", async () => {
	// `userUpdateSchema` is a plain Zod object, which drops unknown keys rather
	// than rejecting them. Without this an admin could smuggle `role` through.
	await PATCH(
		mutatingRequest("PATCH", KNOWN.id, {
			name: "Alice Renamed",
			role: "admin",
		}),
		context(),
	);

	const updateArgs = globalThis.__prisma.user.update.mock.calls[0].arguments[0];
	assert.deepStrictEqual(updateArgs.data, { name: "Alice Renamed" });
});

test("PATCH returns 400 for a body the schema rejects", async () => {
	const response = await PATCH(
		mutatingRequest("PATCH", KNOWN.id, { email: "not-an-email" }),
		context(),
	);

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(dbWrites, []);
});

test("PATCH returns 404 for an unknown id without writing", async () => {
	userById = null;

	const response = await PATCH(
		mutatingRequest("PATCH", "nope", { name: "Renamed" }),
		context("nope"),
	);

	assert.strictEqual(response.status, 404);
	assert.deepStrictEqual(dbWrites, []);
});

test("PATCH returns 403 for a non-admin without writing", async () => {
	requireRoleImpl = async () => {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	};

	const response = await PATCH(
		mutatingRequest("PATCH", KNOWN.id, { name: "Renamed" }),
		context(),
	);

	assert.strictEqual(response.status, 403);
	assert.deepStrictEqual(dbWrites, []);
});

test("PATCH authorizes before checking whether the user exists", async () => {
	// Asserting only on 403 would pass either way: a route that checks existence
	// first and authorizes second returns 403 for an existing user too. The
	// distinguishing signal is whether the lookup ran at all — reordering the two
	// lets a non-admin probe which ids are real via 403-vs-404.
	requireRoleImpl = async () => {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	};

	await PATCH(
		mutatingRequest("PATCH", "nope", { name: "Renamed" }),
		context("nope"),
	);

	assert.strictEqual(
		globalThis.__prisma.user.findUnique.mock.callCount(),
		0,
		"the existence check ran before authorization, leaking which ids are real",
	);
});

test("PATCH rejects a request with no CSRF token before reading or writing", async () => {
	// The throw escapes rather than becoming a Response. `withCsrfProtection` calls
	// `requireCsrfToken` in its own wrapper, outside the handler's try/catch, so
	// `handleError` never sees it. That is the behaviour today — reported in the
	// audit for this PR as a gap, not fixed here — and it is why the assertion is
	// on the rejection rather than on a status code.
	await assert.rejects(
		PATCH(
			new Request(`http://localhost/api/users/${KNOWN.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Renamed" }),
			}),
			context(),
		),
		(error) => {
			assert.strictEqual(error.code, "UNAUTHORIZED");
			return true;
		},
	);

	assert.deepStrictEqual(dbWrites, []);
	assert.strictEqual(
		globalThis.__prisma.user.findUnique.mock.callCount(),
		0,
		"the route read from the database before rejecting the request",
	);
});

test("PATCH surfaces a database failure as 500", async () => {
	updateError = new Error("connection terminated unexpectedly");

	const response = await PATCH(
		mutatingRequest("PATCH", KNOWN.id, { name: "Renamed" }),
		context(),
	);

	assert.strictEqual(response.status, 500);
});

// ── DELETE ────────────────────────────────────────────────────────────────────
//
// The assertions below pin the referential behaviour that exists today, which is
// decided by `packages/db/prisma/schema.prisma` rather than by this route. The
// route's only write is `user.delete(id)`; everything downstream is the database
// acting on the four incoming relations, and the mock records which ones the route
// asked for. Verified against a real Postgres in the audit for this PR: Account,
// Session and AuditLog rows are destroyed by `onDelete: Cascade`, and File rows
// survive with `uploadedById` set to null by `onDelete: SetNull`.

test("DELETE /api/users/[id] deletes the user by id", async () => {
	const response = await DELETE(mutatingRequest("DELETE", KNOWN.id), context());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.success, true);
	assert.deepStrictEqual(dbWrites, [`delete:${KNOWN.id}`]);
});

test("DELETE issues no compensating writes for the user's relations", async () => {
	// Account, Session and AuditLog are `onDelete: Cascade`; File is
	// `onDelete: SetNull`. The route relies on all four and therefore must not
	// hand-delete any of them itself — a manual `file.deleteMany` here would take
	// the blobs' rows with them and defeat the SetNull that keeps them sweepable.
	await DELETE(mutatingRequest("DELETE", KNOWN.id), context());

	assert.deepStrictEqual(
		dbWrites,
		[`delete:${KNOWN.id}`],
		"the route performed a write beyond the user delete itself",
	);
});

test("DELETE returns 404 for an unknown id without deleting", async () => {
	userById = null;

	const response = await DELETE(
		mutatingRequest("DELETE", "nope"),
		context("nope"),
	);

	// `user.delete` is `prisma.user.delete`, which throws P2025 on a missing row.
	// The pre-check is what turns that into a 404 instead of a 500.
	assert.strictEqual(response.status, 404);
	assert.deepStrictEqual(dbWrites, []);
});

test("DELETE returns 403 for a non-admin without deleting", async () => {
	requireRoleImpl = async () => {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	};

	const response = await DELETE(mutatingRequest("DELETE", KNOWN.id), context());

	assert.strictEqual(response.status, 403);
	assert.deepStrictEqual(dbWrites, []);
});

test("DELETE authorizes before checking whether the user exists", async () => {
	// Same reasoning as the PATCH ordering test. For DELETE the stakes are higher:
	// without this ordering a non-admin gets 403 for a real id and 404 for a fake
	// one, which enumerates the user table.
	requireRoleImpl = async () => {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	};

	await DELETE(mutatingRequest("DELETE", "nope"), context("nope"));

	assert.strictEqual(
		globalThis.__prisma.user.findUnique.mock.callCount(),
		0,
		"the existence check ran before authorization, leaking which ids are real",
	);
});

test("DELETE rejects a request with no CSRF token before reading or deleting", async () => {
	// Same shape as the PATCH case: the rejection escapes `handleError`.
	await assert.rejects(
		DELETE(
			new Request(`http://localhost/api/users/${KNOWN.id}`, {
				method: "DELETE",
			}),
			context(),
		),
		(error) => {
			assert.strictEqual(error.code, "UNAUTHORIZED");
			return true;
		},
	);

	assert.deepStrictEqual(dbWrites, []);
	assert.strictEqual(
		globalThis.__prisma.user.findUnique.mock.callCount(),
		0,
		"the route read from the database before rejecting the request",
	);
});

test("DELETE surfaces a database failure as 500", async () => {
	deleteError = new Error("connection terminated unexpectedly");

	const response = await DELETE(mutatingRequest("DELETE", KNOWN.id), context());

	assert.strictEqual(response.status, 500);
});

test("DELETE is gated on admin, so an admin may delete any user including themselves", async () => {
	// There is no self-deletion guard. The route resolves the target purely from
	// the path segment and only checks the caller's role, so the last admin is
	// deletable. Pinned because it is load-bearing behaviour, not an accident to
	// be quietly changed.
	const lastAdmin = { id: "admin-1", role: "admin" };
	requireRoleImpl = async () => ({ user: lastAdmin });
	userById = { ...KNOWN, id: lastAdmin.id, role: "admin" };
	globalThis.__prisma.user.findUnique = mock.fn(async () => userById);

	const response = await DELETE(
		mutatingRequest("DELETE", lastAdmin.id),
		context(lastAdmin.id),
	);

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(dbWrites, [`delete:${lastAdmin.id}`]);
});
