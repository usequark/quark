import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files.
// `me/` is 5 levels below apps/web (me → users → api → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is cached
// after the first call, so a later `mock.module` would not reach the bindings the
// route already holds — including the `withCsrfProtection(...)` wrapper, which is
// built at module scope and therefore freezes whatever `withCsrfProtection` it
// captured. Because of that, CSRF is exercised through the *real* implementation
// rather than a stub: stubbing it away would make every "CSRF rejected" test pass
// regardless of what the wrapper does.

const jwtUrl = pathToFileURL(
	new URL("../../../../lib/jwt.js", import.meta.url).pathname,
).href;

/** What `extractBearerPayload` resolves to for the current test. */
let tokenPayload;
/** When set, `extractBearerPayload` rejects with this error. */
let bearerError;
/** Every Request the route handed to `extractBearerPayload`. */
let bearerRequests;

mock.module(jwtUrl, {
	namedExports: {
		extractBearerPayload: async (request) => {
			bearerRequests.push(request);
			if (bearerError) throw bearerError;
			return tokenPayload;
		},
	},
});

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
	},
});

// ── Prisma mock ──────────────────────────────────────────────────────────────
//
// `user.findById` / `user.update` reach the client through the global Prisma stub,
// matching how `packages/db/src/client.js` resolves it.

let originalPrisma;

/** The row `findById` returns, or null for a miss. */
let userById;
/** When set, `update` rejects with this error. */
let updateError;
/** When set, `findUnique` rejects with this error. */
let findError;
/** Every `findUnique`/`update` the route issued, as `op:id`. */
let dbCalls;

/**
 * Apply a Prisma `select` to a row, the way the client does.
 *
 * Without this the fixture would hand back columns the query never selected, which
 * is the opposite of what the real projection does — and any assertion about which
 * fields the response carries would then be testing the mock.
 */
function project(row, select) {
	if (!select) return { ...row };
	const projected = {};
	for (const [field, include] of Object.entries(select)) {
		if (include) projected[field] = row[field];
	}
	return projected;
}

function setPrismaMock() {
	globalThis.__prisma = {
		user: {
			// `select` is honoured so the fixture stays faithful to Prisma: the
			// `password` column is genuinely never read by `findById`, and a mock that
			// ignored `select` would make every row look like it carried a hash.
			findUnique: mock.fn(async ({ where, select }) => {
				dbCalls.push(`findById:${where.id}`);
				if (findError) throw findError;
				const row = where.id === TOKEN.sub ? (userById ?? null) : null;
				return row === null ? null : project(row, select);
			}),
			update: mock.fn(async ({ where, data, select }) => {
				dbCalls.push(`update:${where.id}`);
				if (updateError) throw updateError;
				return project({ ...userById, ...data }, select);
			}),
		},
	};
}

/** The row as `findById` resolves it for the default token subject. */
const KNOWN = {
	id: "user-1",
	email: "alice@example.com",
	emailVerified: null,
	name: "Alice",
	image: "https://cdn.example.com/alice.png",
	role: "viewer",
	createdAt: "2026-01-02T03:04:05.000Z",
	updatedAt: "2026-01-02T03:04:05.000Z",
};

/** A payload as `extractBearerPayload` returns it for a valid mobile token. */
const TOKEN = {
	sub: "user-1",
	email: "alice@example.com",
	role: "viewer",
};

const { GET, PATCH } = await import("./route.js");

/** A GET to /api/users/me carrying a Bearer header. */
function getRequest() {
	return new Request("http://localhost/api/users/me", {
		headers: { authorization: "Bearer a.b.c" },
	});
}

/**
 * A CSRF-bearing PATCH, as `withCsrfProtection` requires: both the httpOnly cookie
 * the server compares against and the header the client echoes back.
 */
function patchRequest(body) {
	return new Request("http://localhost/api/users/me", {
		method: "PATCH",
		headers: {
			"content-type": "application/json",
			cookie: "csrf_token=test-csrf-token",
			"x-csrf-token": "test-csrf-token",
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

function resetFixtures() {
	tokenPayload = { ...TOKEN };
	bearerError = null;
	bearerRequests = [];
	userById = { ...KNOWN };
	updateError = null;
	findError = null;
	dbCalls = [];
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

// ── GET ───────────────────────────────────────────────────────────────────────

test("GET /api/users/me returns the profile for the token's subject", async () => {
	const request = getRequest();
	const response = await GET(request);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(body, KNOWN);
	// The route resolves the caller from the token and nothing else. This is the
	// whole authorization story for the route — there is no id parameter to tamper
	// with, which is exactly why the source of that id has to be pinned.
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
	// Identity, not structural equality: this pins that the *request the caller sent*
	// is what got authenticated.
	assert.strictEqual(bearerRequests.length, 1);
	assert.strictEqual(bearerRequests[0], request);
});

test("GET resolves the user from the token, not from anything in the URL", async () => {
	// There is no path parameter on this route, so the only thing that can steer the
	// lookup is the token. A `?id=` or a hardcoded id would be an account switcher,
	// and `dbCalls` is what makes that visible: the lookup id has to be `sub`.
	const response = await GET(
		new Request("http://localhost/api/users/me?id=user-2&userId=user-2", {
			headers: { authorization: "Bearer a.b.c" },
		}),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
	assert.strictEqual(body.id, KNOWN.id);
});

test("GET returns the query result verbatim, including the role", async () => {
	// The route serializes whatever `findById` returned without re-projecting it.
	// That is the right shape for a "me" endpoint — the client needs `role` to
	// decide what to render — and it means the response's field set is decided by
	// USER_SAFE_SELECT in packages/db, not by anything here.
	const response = await GET(getRequest());
	const body = await response.json();

	assert.deepStrictEqual(Object.keys(body).sort(), Object.keys(KNOWN).sort());
	assert.strictEqual(body.role, "viewer");
	// And GET is read-only: it must not turn a profile read into a write.
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
});

test("GET returns 401 without reading the database", async () => {
	tokenPayload = null;

	const response = await GET(getRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Authentication required");
	// Ordering: auth runs first, so an unauthenticated caller cannot use this
	// endpoint's response to probe which user ids exist.
	assert.deepStrictEqual(dbCalls, []);
});

test("GET returns 404 for a valid token whose user has been deleted", async () => {
	userById = null;

	const response = await GET(getRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 404);
	assert.strictEqual(body.message, "User not found");
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
});

test("GET surfaces a database failure as 500 rather than a 404", async () => {
	// Answering 404 here would tell the client its account is gone, sending the user
	// to re-register and losing whatever the account owned.
	findError = new Error("connect ECONNREFUSED 10.0.0.5:5432");

	const response = await GET(getRequest());

	assert.strictEqual(response.status, 500);
});

test("a bearer extraction failure surfaces as 500", async () => {
	// The header was token-shaped, so 401 would tell the client to discard a
	// credential that may be perfectly valid.
	bearerError = new Error("jose: unexpected key length");

	const response = await GET(getRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(dbCalls, []);
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

test("PATCH /api/users/me updates the token's subject through userUpdateSchema", async () => {
	const response = await PATCH(patchRequest({ name: "Alice Renamed" }));
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.name, "Alice Renamed");
	assert.deepStrictEqual(dbCalls, ["findById:user-1", "update:user-1"]);
	const updateArgs = globalThis.__prisma.user.update.mock.calls[0].arguments[0];
	assert.deepStrictEqual(updateArgs.data, { name: "Alice Renamed" });
});

test("PATCH cannot promote the caller by putting a role in the body", async () => {
	// The escalation guard. `userUpdateSchema` is a plain Zod object, which drops
	// unknown keys rather than rejecting them, so the protection lives entirely in
	// what reaches `user.update`. If the route stopped validating — or validated
	// with a passthrough schema — `role` and `id` would be written straight to the
	// column and any account could make itself admin.
	await PATCH(
		patchRequest({
			name: "Alice Renamed",
			role: "admin",
			id: "user-2",
			emailVerified: "1970-01-01T00:00:00.000Z",
		}),
	);

	const updateArgs = globalThis.__prisma.user.update.mock.calls[0].arguments[0];
	assert.deepStrictEqual(
		updateArgs.data,
		{ name: "Alice Renamed" },
		"the schema let a field through that is not part of a self-service update",
	);
	// `where.id` must still be the token subject. A body-supplied `id` that
	// redirected the write would be an account takeover, not just a role change.
	assert.strictEqual(updateArgs.where.id, "user-1");
});

test("PATCH updates the account named by the token, not one named in the body", async () => {
	await PATCH(
		patchRequest({
			name: "Alice Renamed",
			id: "user-2",
			userId: "user-2",
			sub: "user-2",
		}),
	);

	const updateArgs = globalThis.__prisma.user.update.mock.calls[0].arguments[0];
	assert.strictEqual(updateArgs.where.id, TOKEN.sub);
	assert.deepStrictEqual(dbCalls, ["findById:user-1", "update:user-1"]);
});

test("PATCH returns 400 for a value the schema rejects, without writing", async () => {
	const response = await PATCH(patchRequest({ email: "not-an-email" }));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.name, "ValidationError");
	// The lookup ran (it is ordered first) but the write must not.
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
});

test("PATCH returns 400 for a body that is not JSON, without writing", async () => {
	const response = await PATCH(patchRequest("{not json"));

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
});

test("PATCH validates the body before checking the user exists", async () => {
	// Ordering, and it is the wrong way round. Today an invalid body against a
	// deleted account answers 404 ("User not found") while a valid body against the
	// same account answers 400 — the account's existence is observable by anyone
	// holding a token for it, before validation has rejected them anyway.
	userById = null;

	const response = await PATCH(patchRequest({ email: "not-an-email" }));
	const body = await response.json();

	assert.strictEqual(response.status, 404);
	assert.strictEqual(body.message, "User not found");
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
});

test("PATCH returns 404 for a deleted user without writing", async () => {
	userById = null;

	const response = await PATCH(patchRequest({ name: "Alice Renamed" }));

	assert.strictEqual(response.status, 404);
	assert.deepStrictEqual(dbCalls, ["findById:user-1"]);
});

test("PATCH returns 401 without reading or writing", async () => {
	tokenPayload = null;

	const response = await PATCH(patchRequest({ name: "Alice Renamed" }));
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Authentication required");
	assert.deepStrictEqual(dbCalls, []);
});

test("PATCH returns 401 for a request with no CSRF token, without touching the database", async () => {
	// `withCsrfProtection` runs its check in its own wrapper, outside this
	// handler's try/catch, so the wrapper produces the Response — `handleError`
	// never sees it. Asserting on a status code rather than a rejection is the
	// point: the throw reached the client as an unhandled rejection.
	const response = await PATCH(
		new Request("http://localhost/api/users/me", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Alice Renamed" }),
		}),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.code, "UNAUTHORIZED");
	assert.deepStrictEqual(dbCalls, []);
});

test("PATCH rejects a mismatched CSRF token, not just a missing one", async () => {
	// Header present, cookie present, values different. The comparison has to be on
	// the values, or any client that can set a header satisfies the check.
	const response = await PATCH(
		new Request("http://localhost/api/users/me", {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
				cookie: "csrf_token=cookie-token",
				"x-csrf-token": "header-token",
			},
			body: JSON.stringify({ name: "Alice Renamed" }),
		}),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.code, "UNAUTHORIZED");
	assert.deepStrictEqual(dbCalls, []);
});

test("PATCH surfaces a failed write as 500", async () => {
	updateError = new Error("connect ECONNREFUSED 10.0.0.5:5432");

	const response = await PATCH(patchRequest({ name: "Alice Renamed" }));

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(dbCalls, ["findById:user-1", "update:user-1"]);
});

test("PATCH lets the caller change their own email", async () => {
	// The flip side of the escalation guard: `email` is in `userUpdateSchema`, so a
	// self-service email change is intended. Pinning it stops a future tightening
	// from being mistaken for a fix.
	const response = await PATCH(
		patchRequest({ email: "alice.new@example.com" }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.email, "alice.new@example.com");
	const updateArgs = globalThis.__prisma.user.update.mock.calls[0].arguments[0];
	assert.deepStrictEqual(updateArgs.data, { email: "alice.new@example.com" });
});

test("PATCH does not reissue tokens or otherwise act outside the profile update", async () => {
	await PATCH(patchRequest({ name: "Alice Renamed" }));

	// One lookup and one write. Anything else here — a token issue, a second update
	// for the session table — would be a side effect of a profile rename.
	assert.deepStrictEqual(dbCalls, ["findById:user-1", "update:user-1"]);
	assert.strictEqual(
		Object.keys(globalThis.__prisma.user).length,
		2,
		"the route touched a database model other than user",
	);
});
