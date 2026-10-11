import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";

// Resolve the @/ alias used by route files.
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported.

const auth = await import("@usequark/quark-core/auth");

// `hashToken` stays real for the same reason it does in the reset test: the
// lookup key assertion is only meaningful against the true digest.
mock.module("@usequark/quark-core/auth", {
	namedExports: {
		...auth,
	},
});

const core = await import("@usequark/quark-core/core");

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

mock.module("@usequark/quark-config", {
	namedExports: {
		getAppUrl: () => "https://app.test",
	},
});

const db = await import("@usequark/quark-db");

/** The row `verificationToken.findByToken` resolves to, or null. */
let tokenRecord;
/** Every digest passed to `verificationToken.findByToken`, in order. */
let findByTokenCalls;
/** Every identifier passed to `verificationToken.deleteByIdentifier`. */
let deletionCalls;
/** The account `user.findByEmail` resolves to, or null. */
let account;
/** Every (id, data) pair passed to `user.update`. */
let updateCalls;
/** When set, `user.findByEmail` rejects with this error. */
let dbError;

mock.module("@usequark/quark-db", {
	namedExports: {
		...db,
		user: {
			findByEmail: async () => {
				if (dbError) throw dbError;
				return account;
			},
			update: async (id, data) => {
				updateCalls.push({ id, data });
				return { ...account, ...data };
			},
		},
		verificationToken: {
			findByToken: async (tokenHash) => {
				findByTokenCalls.push(tokenHash);
				return tokenRecord;
			},
			deleteByIdentifier: async (identifier) => {
				deletionCalls.push(identifier);
			},
		},
	},
});

const { GET } = await import("./route.js");

const RAW_TOKEN =
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function liveToken() {
	return {
		identifier: "existing@example.com",
		token: auth.hashToken(RAW_TOKEN),
		expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
	};
}

function verifyRequest(token = RAW_TOKEN) {
	return new Request(
		`http://localhost/api/auth/verify-email${token ? `?token=${token}` : ""}`,
	);
}

const SIGNIN = "https://app.test/auth/signin";

function resetFixtures() {
	tokenRecord = liveToken();
	findByTokenCalls = [];
	deletionCalls = [];
	account = {
		id: "user-1",
		email: "existing@example.com",
		name: "Existing",
		emailVerified: null,
	};
	updateCalls = [];
	dbError = null;
}

beforeEach(() => {
	resetFixtures();
});

afterEach(() => {
	mock.restoreAll();
});

test("confirms an unverified address and redirects to the sign-in page", async () => {
	const before = Date.now();
	const response = await GET(verifyRequest());
	const after = Date.now();

	// A mail client navigates to the link, so the outcome is a redirect to the
	// sign-in page with a status that says "confirmed" rather than a JSON body.
	assert.strictEqual(response.status, 307);
	assert.strictEqual(response.headers.get("location"), `${SIGNIN}?verified=1`);
	// The lookup is by digest; the raw bearer value never reaches the database.
	assert.deepStrictEqual(findByTokenCalls, [auth.hashToken(RAW_TOKEN)]);
	assert.strictEqual(updateCalls.length, 1);
	assert.strictEqual(updateCalls[0].id, "user-1");
	assert.ok(updateCalls[0].data.emailVerified instanceof Date);
	assert.ok(
		updateCalls[0].data.emailVerified.getTime() >= before &&
			updateCalls[0].data.emailVerified.getTime() <= after,
	);
	// Single-use: the confirmation link dies with the address it confirmed.
	assert.deepStrictEqual(deletionCalls, ["existing@example.com"]);
});

test("leaves an already-confirmed address alone but still consumes the link", async () => {
	account.emailVerified = new Date("2026-01-01T00:00:00Z");

	const response = await GET(verifyRequest());

	assert.strictEqual(response.status, 307);
	assert.strictEqual(response.headers.get("location"), `${SIGNIN}?verified=1`);
	// No write: the flag is already set. The token still dies so a replayed
	// link does not keep working forever.
	assert.deepStrictEqual(updateCalls, []);
	assert.deepStrictEqual(deletionCalls, ["existing@example.com"]);
});

test("redirects to invalid for an expired link", async () => {
	tokenRecord = {
		...liveToken(),
		expires: new Date(Date.now() - 1000),
	};

	const response = await GET(verifyRequest());

	assert.strictEqual(response.status, 307);
	assert.strictEqual(
		response.headers.get("location"),
		`${SIGNIN}?verified=invalid`,
	);
	// Nothing is written or deleted for a dead link: an attacker replaying an
	// old email gets the same redirect as a first-time visitor.
	assert.deepStrictEqual(updateCalls, []);
	assert.deepStrictEqual(deletionCalls, []);
});

test("redirects to invalid when the account is gone, burning the token", async () => {
	account = null;

	const response = await GET(verifyRequest());

	assert.strictEqual(response.status, 307);
	assert.strictEqual(
		response.headers.get("location"),
		`${SIGNIN}?verified=invalid`,
	);
	// The confirmation would be for nobody; leaving a live link in the inbox
	// would let it confirm the address later, for whoever owns it then.
	assert.deepStrictEqual(deletionCalls, ["existing@example.com"]);
	assert.deepStrictEqual(updateCalls, []);
});

test("redirects to invalid for a missing token without a lookup", async () => {
	const response = await GET(verifyRequest(null));

	assert.strictEqual(response.status, 307);
	assert.strictEqual(
		response.headers.get("location"),
		`${SIGNIN}?verified=invalid`,
	);
	assert.deepStrictEqual(findByTokenCalls, []);
});

test("redirects to error when something breaks server-side", async () => {
	// A database outage must not surface a bare 500 to a mail client that just
	// clicked a link: the caller still lands on the sign-in page, and the
	// failure is in the logs. The throw comes from the same mocked module the
	// happy path uses, via a fixture flag, so no re-registration is needed.
	dbError = new Error("connect ECONNREFUSED postgres://db:5432");

	const response = await GET(verifyRequest());

	assert.strictEqual(response.status, 307);
	assert.strictEqual(
		response.headers.get("location"),
		`${SIGNIN}?verified=error`,
	);
});
