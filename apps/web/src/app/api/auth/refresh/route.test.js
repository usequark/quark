import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "@usequark/quark-core/errors";

// Resolve the @/ alias used by route files.
// `refresh/` is 5 levels below apps/web (auth → api → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds — including the module-scope
// `createLogger("auth-refresh")` call the route makes at import time.

const jwtUrl = pathToFileURL(
	new URL("../../../../lib/jwt.js", import.meta.url).pathname,
).href;

/** What `verifyMobileToken` resolves to for the current test. */
let tokenPayload;
/** When set, `verifyMobileToken` rejects with this error. */
let verifyError;
/** When set, `issueTokenPair` rejects with this error. */
let issueError;
/** Every subject `issueTokenPair` was handed. */
let issueCalls;
/** Every string the route passed to `verifyMobileToken`. */
let verifyCalls;
/** Warning messages the route's logger received. */
let logWarnings;
/** The row `user.findById` resolves to for the current test, or null. */
let storedAccount;
/** Every subject the route asked the query layer to resolve. */
let lookupCalls;

mock.module(jwtUrl, {
	namedExports: {
		verifyMobileToken: async (token) => {
			verifyCalls.push(token);
			if (verifyError) throw verifyError;
			return tokenPayload;
		},
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

const core = await import("@usequark/quark-core/core");

mock.module("@usequark/quark-core/core", {
	namedExports: {
		...core,
		createLogger: () => ({
			info() {},
			error() {},
			warn: (message) => {
				logWarnings.push(message);
			},
			debug() {},
		}),
	},
});

// The route re-reads identity and role from the database on every exchange, so
// that read is the seam for these fast unit tests. The real-Prisma kill-tests
// live in `route.integration.test.js`; here the row is a fixture.
const db = await import("@usequark/quark-db");

/** The row `user.findById` resolves to when `storedAccount` is not null. */
function accountFixture(overrides = {}) {
	return {
		id: "user-1",
		email: "alice@example.com",
		name: "Alice",
		role: "viewer",
		passwordChangedAt: null,
		...overrides,
	};
}

mock.module("@usequark/quark-db", {
	namedExports: {
		...db,
		user: {
			findById: async (id) => {
				lookupCalls.push(id);
				return storedAccount;
			},
		},
	},
});

/** A payload as `verifyMobileToken` returns it for a genuine refresh token. */
const REFRESH_PAYLOAD = {
	sub: "user-1",
	type: "refresh",
	// The token itself only carries `sub` and `type` (see lib/jwt.js). Any other
	// claim here is bait: the route must ignore it and use the database row.
	email: "stale@example.com",
	name: "Stale Name",
	role: "admin",
};

const { POST } = await import("./route.js");

function refreshRequest(body = { refreshToken: "a.b.c" }) {
	return new Request("http://localhost/api/auth/refresh", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	tokenPayload = { ...REFRESH_PAYLOAD };
	verifyError = null;
	issueError = null;
	storedAccount = accountFixture();
	issueCalls = [];
	verifyCalls = [];
	lookupCalls = [];
	logWarnings = [];
});

afterEach(() => {
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("POST /api/auth/refresh issues a new access token for a valid refresh token", async () => {
	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.token, "issued.access.token");
	assert.deepStrictEqual(verifyCalls, ["a.b.c"]);
	// The subject selects the row; the claims come from the database, never from
	// the 30-day-old token. `sub` is remapped to `id` because that is the field
	// `issueTokenPair` reads.
	assert.deepStrictEqual(lookupCalls, ["user-1"]);
	assert.deepStrictEqual(issueCalls, [
		{
			id: "user-1",
			email: "alice@example.com",
			name: "Alice",
			role: "viewer",
		},
	]);
});

test("POST returns only the access token, not a fresh refresh token", async () => {
	const response = await POST(refreshRequest());
	const body = await response.json();

	// `issueTokenPair` mints a new refresh token internally and this route drops
	// it, so the caller keeps using the token it already holds for its full
	// 30-day life. Pinning the exact key set makes the shape — and the
	// non-rotation — explicit rather than incidental.
	assert.deepStrictEqual(Object.keys(body), ["token"]);
});

test("POST returns 401 and issues nothing for a token that fails verification", async () => {
	// `verifyMobileToken` collapses "bad signature" and "expired" into a single
	// null, so the route cannot — and must not try to — distinguish them.
	tokenPayload = null;

	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid or expired refresh token");
	assert.deepStrictEqual(issueCalls, []);
	// A token that never verified must not reach the database.
	assert.deepStrictEqual(lookupCalls, []);
	// A rejected refresh is an operational signal worth a warning line.
	assert.deepStrictEqual(logWarnings, ["Invalid refresh token"]);
});

test("POST rejects an access token presented as a refresh token", async () => {
	// An access token is a perfectly valid signature with no `type` claim. If the
	// type check were dropped, anyone holding a 1-hour access token could mint
	// unlimited new ones from it and the 1h expiry would never bind.
	tokenPayload = {
		sub: "user-1",
		email: "alice@example.com",
		name: "Alice",
		role: "viewer",
	};

	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid token type");
	assert.deepStrictEqual(issueCalls, []);
	// The type is checked before any lookup, so a misused access token costs no
	// database round trip.
	assert.deepStrictEqual(lookupCalls, []);
	// The type rejection is a client error, not a token forgery — it is not
	// logged as one.
	assert.deepStrictEqual(logWarnings, []);
});

test("POST does not echo the rejected token or its claims in the 401 body", async () => {
	tokenPayload = null;

	const response = await POST(
		refreshRequest({ refreshToken: "eyJhbGciOiJIUzI1NiJ9.super-secret" }),
	);
	const raw = await response.text();

	// The token is a bearer credential. Reflecting it back, or reflecting which
	// check failed, hands the caller a distinguishable body per failure mode.
	assert.ok(
		!raw.includes("super-secret"),
		`401 body echoed the submitted token: ${raw}`,
	);
	// Exactly one generic message and nothing else — no `error` detail from
	// `verifyMobileToken`, no claims read out of the payload.
	assert.deepStrictEqual(JSON.parse(raw), {
		message: "Invalid or expired refresh token",
	});
});

test("POST takes the identity from the database row and ignores stale token and body claims", async () => {
	// REFRESH_PAYLOAD carries a stale email/name and an `admin` role that a
	// 30-day-old token might still be holding; the row says viewer. Body fields
	// are a privilege-escalation primitive if honoured.
	storedAccount = accountFixture({
		email: "alice@example.com",
		name: "Alice",
		role: "viewer",
	});

	const response = await POST(
		refreshRequest({
			refreshToken: "a.b.c",
			email: "attacker@evil.example",
			sub: "admin-1",
			role: "admin",
		}),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(lookupCalls, ["user-1"]);
	assert.deepStrictEqual(issueCalls, [
		{
			id: "user-1",
			email: "alice@example.com",
			name: "Alice",
			role: "viewer",
		},
	]);
	assert.strictEqual(body.token, "issued.access.token");
});

test("POST mints the current role, so a demotion is not undone by an old token", async () => {
	// The row is the only source of the role; whatever the token once said is
	// irrelevant. This mirrors `validateSessionToken`, which refreshes the role
	// into a web session on every request.
	storedAccount = accountFixture({ role: "viewer" });

	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(issueCalls, [
		{
			id: "user-1",
			email: "alice@example.com",
			name: "Alice",
			role: "viewer",
		},
	]);
	assert.strictEqual(body.token, "issued.access.token");
});

test("POST refuses a refresh token whose account no longer exists", async () => {
	// Deleted (or otherwise removed) between issue and exchange: there is no row
	// to re-derive identity from, so the exchange is refused rather than minting
	// an access token for a ghost.
	storedAccount = null;

	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid or expired refresh token");
	assert.deepStrictEqual(issueCalls, []);
	assert.deepStrictEqual(logWarnings, [
		"Refresh token for an account that no longer exists",
	]);
});

test("POST refuses a refresh token issued before the password was changed", async () => {
	// A password reset stamps `passwordChangedAt`. A refresh token minted before
	// that instant must not survive it, or an attacker holding the old token
	// keeps minting access tokens for 30 days.
	const passwordChangedAt = new Date("2026-10-11T12:00:00Z");
	storedAccount = accountFixture({ passwordChangedAt });
	tokenPayload = {
		...REFRESH_PAYLOAD,
		iat: Math.floor(passwordChangedAt.getTime() / 1000) - 3600,
	};

	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid or expired refresh token");
	assert.deepStrictEqual(issueCalls, []);
	assert.deepStrictEqual(logWarnings, [
		"Refresh token issued before the password changed",
	]);
});

test("POST accepts a refresh token issued at or after the password change", async () => {
	const passwordChangedAt = new Date("2026-10-11T12:00:00Z");
	storedAccount = accountFixture({ passwordChangedAt });
	tokenPayload = {
		...REFRESH_PAYLOAD,
		iat: Math.floor(passwordChangedAt.getTime() / 1000) + 60,
	};

	const response = await POST(refreshRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(issueCalls.length, 1);
});

test("POST refuses a verified token that carries no subject", async () => {
	// `verifyMobileToken` only proves the signature, issuer and expiry. A token
	// with no `sub` names no row, so it is refused without a lookup.
	tokenPayload = { type: "refresh" };

	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid or expired refresh token");
	assert.deepStrictEqual(lookupCalls, []);
	assert.deepStrictEqual(issueCalls, []);
	assert.deepStrictEqual(logWarnings, ["Refresh token has no subject"]);
});

test("POST returns 400 and verifies nothing when refreshToken is missing", async () => {
	const response = await POST(refreshRequest({}));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.code, "VALIDATION_ERROR");
	// An absent token must be rejected by the schema, not by `verifyMobileToken`
	// — otherwise the log fills with warnings for malformed clients and the
	// missing-field case is indistinguishable from a forged token.
	assert.deepStrictEqual(verifyCalls, []);
	assert.deepStrictEqual(logWarnings, []);
});

test("POST returns 400 and verifies nothing when refreshToken is empty", async () => {
	const response = await POST(refreshRequest({ refreshToken: "" }));

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(verifyCalls, []);
});

test("POST returns 400 for a body that is not JSON", async () => {
	const response = await POST(refreshRequest("{not json"));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.name, "ValidationError");
	assert.deepStrictEqual(verifyCalls, []);
});

test("POST returns 500 and issues nothing when issuing the new token fails", async () => {
	// The signature was valid, so this is a server fault (typically an unset
	// NEXTAUTH_SECRET). Answering 401 would tell the mobile client to discard a
	// perfectly good refresh token and send the user to the login screen.
	issueError = new AppError("NEXTAUTH_SECRET not configured", 500);

	const response = await POST(refreshRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 500);
	assert.strictEqual(body.code, "INTERNAL_ERROR");
	assert.deepStrictEqual(Object.keys(body), [
		"name",
		"message",
		"code",
		"statusCode",
		"timestamp",
	]);
});

test("POST turns a thrown verification error into a response", async () => {
	// `verifyMobileToken` swallows its own failures and returns null, but the
	// route must still not depend on that: if it ever throws, the request is a
	// 500, not an unhandled rejection in the Next.js request path.
	verifyError = new Error("jose: unexpected key length");

	const response = await POST(refreshRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(issueCalls, []);
});
