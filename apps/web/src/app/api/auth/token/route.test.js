import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files.
// `token/` is 5 levels below apps/web (auth → api → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds.

const jwtUrl = pathToFileURL(
	new URL("../../../../lib/jwt.js", import.meta.url).pathname,
).href;

/** Every subject `issueTokenPair` was handed. */
let issueCalls;
/** When set, `issueTokenPair` rejects with this error. */
let issueError;

mock.module(jwtUrl, {
	namedExports: {
		issueTokenPair: async (subject) => {
			issueCalls.push(subject);
			if (issueError) throw issueError;
			return {
				token: "issued.access.token",
				refreshToken: "issued.refresh.token",
				expiresAt: "2026-10-07T12:00:00.000Z",
			};
		},
	},
});

// `findByEmail` is driven through the global Prisma stub, matching how
// packages/db/src/queries.js reaches the client.
let originalPrisma;

/** The row `user.findByEmail` resolves to, or null. */
let storedUser;
/** When set, `user.findByEmail` rejects with this error. */
let findError;
/** Every email the route looked up. */
let lookupCalls;

function setPrismaMock() {
	globalThis.__prisma = {
		user: {
			findUnique: async ({ where }) => {
				lookupCalls.push(where.email);
				if (findError) throw findError;
				return storedUser;
			},
		},
	};
}

const db = await import("@usequark/quark-db");

mock.module("@usequark/quark-db", {
	namedExports: {
		...db,
		user: {
			findByEmail: (email) =>
				globalThis.__prisma.user.findUnique({ where: { email } }),
		},
	},
});

const core = await import("@usequark/quark-core/core");
const auth = await import("@usequark/quark-core/auth");

/** Every `[plaintext, hash]` pair `verifyPassword` was handed. */
let verifyCalls;
/** What `verifyPassword` resolves to. */
let verifyResult;
/** When set, `verifyPassword` rejects with this error. */
let verifyError;

mock.module("@usequark/quark-core/core", {
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

mock.module("@usequark/quark-core/auth", {
	namedExports: {
		...auth,
		verifyPassword: async (plaintext, hash) => {
			verifyCalls.push([plaintext, hash]);
			if (verifyError) throw verifyError;
			return verifyResult;
		},
	},
});

const STORED = {
	id: "user-1",
	email: "alice@example.com",
	name: "Alice",
	role: "viewer",
	password: "bcrypt$alice-hash",
};

const { POST } = await import("./route.js");

function tokenRequest(body) {
	return new Request("http://localhost/api/auth/token", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

/** A request carrying the correct credentials for the `STORED` row. */
function validRequest() {
	return tokenRequest({ email: "alice@example.com", password: "Str0ngPass" });
}

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	storedUser = { ...STORED };
	findError = null;
	lookupCalls = [];
	issueCalls = [];
	issueError = null;
	verifyCalls = [];
	verifyResult = true;
	verifyError = null;
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

test("POST /api/auth/token exchanges correct credentials for a token pair", async () => {
	const response = await POST(validRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(body, {
		token: "issued.access.token",
		refreshToken: "issued.refresh.token",
		expiresAt: "2026-10-07T12:00:00.000Z",
	});
	assert.deepStrictEqual(lookupCalls, ["alice@example.com"]);
	// Plaintext first, stored hash second. Swapping them makes bcrypt compare a
	// hash against itself and reject every legitimate login, so the argument
	// order is pinned rather than assumed.
	assert.deepStrictEqual(verifyCalls, [["Str0ngPass", "bcrypt$alice-hash"]]);
	// The claims come from the database row, never from the request body.
	assert.deepStrictEqual(issueCalls, [{ ...STORED }]);
});

test("POST returns 401 for a wrong password and issues nothing", async () => {
	verifyResult = false;

	const response = await POST(
		tokenRequest({ email: "alice@example.com", password: "wrong" }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid credentials");
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns 401 for an unknown email without running the password check", async () => {
	// A known address runs a bcrypt compare; an unknown one returns in
	// microseconds. Answering identically is what keeps this endpoint from
	// confirming which addresses have accounts.
	storedUser = null;

	const response = await POST(
		tokenRequest({ email: "nobody@example.com", password: "Str0ngPass" }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid credentials");
	assert.deepStrictEqual(lookupCalls, ["nobody@example.com"]);
	// The guard short-circuits *before* the bcrypt compare. Running the compare
	// here — against a null hash — would both add a meaningless ~100ms of work
	// to every probe and turn a miss into a 500 from inside bcrypt.
	assert.deepStrictEqual(verifyCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns 401 for an OAuth-only account that has no password set", async () => {
	// A user created through NextAuth has `password: null`. Verifying against a
	// null hash would either throw (→ 500, leaking that the account exists) or,
	// depending on the bcrypt version, compare against the empty string.
	storedUser = { ...STORED, password: null };

	const response = await POST(validRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid credentials");
	assert.deepStrictEqual(verifyCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns the same 401 for an unknown email and a wrong password", async () => {
	storedUser = null;
	const unknown = await (
		await POST(
			tokenRequest({ email: "nobody@example.com", password: "Str0ngPass" }),
		)
	).text();

	storedUser = { ...STORED };
	verifyResult = false;
	const wrong = await (
		await POST(tokenRequest({ email: "alice@example.com", password: "wrong" }))
	).text();

	// Byte-identical bodies. Any difference here — a message, a status, an extra
	// field — is enough to tell an attacker which addresses are registered.
	assert.strictEqual(unknown, wrong);
	assert.ok(!unknown.includes("alice@example.com"));
});

test("POST never returns the stored password hash", async () => {
	const response = await POST(validRequest());
	const raw = await response.text();

	// The hash is the credential. `issueTokenPair` receives the full row because
	// it needs `id`, `email`, `name` and `role`, so the hash travels through
	// this handler and must not travel back out of it.
	assert.ok(
		!raw.includes("bcrypt$alice-hash"),
		`token response leaked the stored hash: ${raw}`,
	);
	assert.deepStrictEqual(Object.keys(JSON.parse(raw)).sort(), [
		"expiresAt",
		"refreshToken",
		"token",
	]);
});

test("POST takes the identity from the database row, not from the body", async () => {
	// Role and name are not in the request schema, but Zod strips unknown keys
	// rather than rejecting them, so a client sending `role` is only safe
	// because the route signs the row it read back.
	const response = await POST(
		tokenRequest({
			email: "alice@example.com",
			password: "Str0ngPass",
			role: "admin",
			name: "Impostor",
		}),
	);

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(issueCalls, [{ ...STORED }]);
	assert.strictEqual(issueCalls[0].role, "viewer");
	assert.strictEqual(issueCalls[0].name, "Alice");
});

test("POST returns 400 and looks up nothing for a malformed email", async () => {
	const response = await POST(
		tokenRequest({ email: "not-an-email", password: "Str0ngPass" }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.code, "VALIDATION_ERROR");
	// The schema must gate the lookup, not the reverse: an unvalidated address
	// reaching `findByEmail` turns this endpoint into an address oracle.
	assert.deepStrictEqual(lookupCalls, []);
	assert.deepStrictEqual(verifyCalls, []);
});

test("POST returns 400 and looks up nothing for an empty password", async () => {
	const response = await POST(
		tokenRequest({ email: "alice@example.com", password: "" }),
	);

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(lookupCalls, []);
	assert.deepStrictEqual(verifyCalls, []);
});

test("POST returns 400 for a body that is not JSON", async () => {
	const response = await POST(tokenRequest("{not json"));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.name, "ValidationError");
	assert.deepStrictEqual(lookupCalls, []);
});

test("POST returns 401 rather than 500 when the password check reports failure", async () => {
	// bcrypt.compare answers false for a mismatch; the route must map that to a
	// 401 and not fall through to the error handler.
	verifyResult = false;

	const response = await POST(validRequest());

	assert.strictEqual(response.status, 401);
});

test("POST does not swallow a lookup failure as bad credentials", async () => {
	// A dropped database connection is a 500, not a 401. Answering 401 would
	// tell every user their password is wrong and send them into a reset flow
	// for an outage.
	findError = new Error("connect ECONNREFUSED 10.0.0.5:5432");

	const response = await POST(validRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 500);
	assert.strictEqual(body.code, "INTERNAL_ERROR");
	assert.deepStrictEqual(verifyCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST does not swallow a hashing failure as bad credentials", async () => {
	// Same reasoning as the lookup: bcrypt blowing up (a corrupt hash column, a
	// missing native binding) is a server fault. Reporting 401 here would blame
	// the user for the outage and hide the real failure behind a 401 rate.
	verifyError = new Error("Illegal arguments: string, undefined");

	const response = await POST(validRequest());
	const raw = await response.text();

	assert.strictEqual(response.status, 500);
	assert.ok(
		!raw.includes("Illegal arguments"),
		`error body leaked the internal message: ${raw}`,
	);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns 500 when issuing the token pair fails", async () => {
	// e.g. NEXTAUTH_SECRET is not configured. A 401 here would discard a
	// perfectly good password and lock the user out.
	issueError = new Error("NEXTAUTH_SECRET not configured");

	const response = await POST(validRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 500);
	assert.strictEqual(body.code, "INTERNAL_ERROR");
	// The password was already correct, so the credential check must not have to
	// be repeated by the client.
	assert.deepStrictEqual(verifyCalls, [["Str0ngPass", "bcrypt$alice-hash"]]);
});
