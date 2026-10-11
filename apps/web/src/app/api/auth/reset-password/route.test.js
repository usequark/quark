import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";

// Resolve the @/ alias used by route files.
// `reset-password/` is 5 levels below apps/web (auth → api → app → src → web),
// so `src/lib/` is 4 levels up from here.
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds.

const auth = await import("@usequark/quark-core/auth");

/**
 * Every plaintext handed to `hashPassword`.
 *
 * `hashToken` is deliberately NOT mocked: the interesting assertion of the
 * reset flow is that the lookup key is the SHA-256 digest of the presented
 * token, and only a real `hashToken` can say what that digest is.
 */
let hashCalls;

mock.module("@usequark/quark-core/auth", {
	namedExports: {
		...auth,
		hashPassword: async (password) => {
			hashCalls.push(password);
			return `hashed:${password}`;
		},
	},
});

// `passwordSchema` stays real — the point of the weak-password tests is that
// this route applies *that* schema, and a stubbed schema would make them pass
// by construction.
const db = await import("@usequark/quark-db");

/** The row `verificationToken.findByToken` resolves to, or null. */
let tokenRecord;
/** Every digest passed to `verificationToken.findByToken`, in order. */
let findByTokenCalls;
/** Every identifier passed to `verificationToken.deleteByIdentifier`. */
let deletionCalls;

mock.module("@usequark/quark-db", {
	namedExports: {
		...db,
		user: {
			findByEmail: async (email) => {
				findByEmailCalls.push(email);
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

const { GET, POST } = await import("./route.js");

const RAW_TOKEN =
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/** The row a freshly issued reset link resolves to. */
function liveToken() {
	return {
		identifier: "existing@example.com",
		token: auth.hashToken(RAW_TOKEN),
		expires: new Date(Date.now() + 60 * 60 * 1000),
	};
}

function resetRequest(body = { token: RAW_TOKEN, password: "NewStr0ngPass" }) {
	return new Request("http://localhost/api/auth/reset-password", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: "csrf_token=test-csrf-token",
			"x-csrf-token": "test-csrf-token",
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

let account;
let findByEmailCalls;
let updateCalls;

function resetFixtures() {
	account = {
		id: "user-1",
		email: "existing@example.com",
		name: "Existing",
		password: "hashed:old",
	};
	tokenRecord = liveToken();
	findByTokenCalls = [];
	deletionCalls = [];
	findByEmailCalls = [];
	updateCalls = [];
	hashCalls = [];
}

beforeEach(() => {
	resetFixtures();
});

afterEach(() => {
	mock.restoreAll();
});

// ── POST ─────────────────────────────────────────────────────────────────────

test("POST resets the password and consumes the token", async () => {
	const before = Date.now();
	const response = await POST(resetRequest());
	const after = Date.now();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(
		(await response.json()).message,
		"Your password has been updated. You can now sign in.",
	);
	// The plaintext goes to bcrypt; the digest is what resolved the link.
	assert.deepStrictEqual(hashCalls, ["NewStr0ngPass"]);
	assert.strictEqual(updateCalls.length, 1);
	assert.strictEqual(updateCalls[0].id, "user-1");
	assert.strictEqual(updateCalls[0].data.password, "hashed:NewStr0ngPass");
	// Stamping `passwordChangedAt` is what reaches every live session: the web
	// JWT and the mobile refresh token reject anything issued before this
	// instant, so a password known to an attacker stops working the moment it
	// is replaced.
	assert.ok(updateCalls[0].data.passwordChangedAt instanceof Date);
	assert.ok(
		updateCalls[0].data.passwordChangedAt.getTime() >= before &&
			updateCalls[0].data.passwordChangedAt.getTime() <= after,
	);
	// Single-use: the token dies with the reset it performed.
	assert.deepStrictEqual(deletionCalls, ["existing@example.com"]);
});

test("POST looks up the token by its SHA-256 digest, never the raw value", async () => {
	await POST(resetRequest());

	// The database holds only the digest (see issueVerificationToken). If the
	// route ever queried by the raw token, a leaked database row would be
	// redeemable and this lookup would miss every stored row.
	assert.deepStrictEqual(findByTokenCalls, [auth.hashToken(RAW_TOKEN)]);
	assert.notStrictEqual(findByTokenCalls[0], RAW_TOKEN);
});

test("POST refuses an expired link identically to an unknown one", async () => {
	tokenRecord = {
		...liveToken(),
		expires: new Date(Date.now() - 1000),
	};

	const expired = await POST(resetRequest());
	tokenRecord = null;
	const unknown = await POST(resetRequest());

	// Same status, same wording, same code: an attacker replaying a stolen,
	// expired link learns nothing from the different responses they would
	// otherwise get. (Bodies also carry a per-request timestamp, so equality is
	// asserted on the fields a caller can rely on.)
	assert.strictEqual(expired.status, 400);
	assert.strictEqual(unknown.status, 400);
	const expiredBody = await expired.json();
	const unknownBody = await unknown.json();
	assert.strictEqual(expiredBody.message, unknownBody.message);
	assert.strictEqual(
		expiredBody.message,
		"This reset link is invalid or has expired. Request a new one.",
	);
	assert.strictEqual(expiredBody.code, "VALIDATION_ERROR");
	assert.strictEqual(unknownBody.code, "VALIDATION_ERROR");
	assert.deepStrictEqual(updateCalls, []);
	assert.deepStrictEqual(deletionCalls, []);
});

test("POST burns the token and refuses when the account is gone", async () => {
	account = null;

	const response = await POST(resetRequest());

	assert.strictEqual(response.status, 400);
	assert.strictEqual(
		(await response.json()).message,
		"This reset link is invalid or has expired. Request a new one.",
	);
	// The account was deleted after the link was issued; the link must not
	// survive to be tried again once the address frees up.
	assert.deepStrictEqual(deletionCalls, ["existing@example.com"]);
	assert.deepStrictEqual(updateCalls, []);
});

test("POST returns 400 for a password the schema rejects, before any lookup", async () => {
	const response = await POST(
		resetRequest({ token: RAW_TOKEN, password: "weak" }),
	);

	assert.strictEqual(response.status, 400);
	assert.strictEqual((await response.json()).code, "VALIDATION_ERROR");
	// The token must not even be looked up for an invalid payload: probing the
	// link validity with an intentionally broken password would otherwise work.
	assert.deepStrictEqual(findByTokenCalls, []);
	assert.deepStrictEqual(updateCalls, []);
});

test("POST returns 400 for a missing body", async () => {
	const response = await POST(resetRequest(""));

	assert.strictEqual(response.status, 400);
	assert.strictEqual((await response.json()).name, "ValidationError");
	assert.deepStrictEqual(findByTokenCalls, []);
});

test("POST rejects a cross-site request that carries no CSRF token", async () => {
	const response = await POST(
		new Request("http://localhost/api/auth/reset-password", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token: RAW_TOKEN, password: "NewStr0ngPass" }),
		}),
	);

	assert.strictEqual(response.status, 401);
	// The link is never even checked: a browser-driven forgery must die at the
	// wrapper, not inside the handler where the token lookup could be timed.
	assert.deepStrictEqual(findByTokenCalls, []);
	assert.deepStrictEqual(updateCalls, []);
});

test("POST turns a thrown error into a response instead of propagating it", async () => {
	tokenRecord = {
		...liveToken(),
		get expires() {
			throw new Error("boom");
		},
	};

	const response = await POST(resetRequest());

	assert.strictEqual(response.status, 500);
	assert.strictEqual((await response.json()).code, "INTERNAL_ERROR");
});

// ── GET ──────────────────────────────────────────────────────────────────────

test("GET reports a live link as valid", async () => {
	const response = await GET(
		new Request(`http://localhost/api/auth/reset-password?token=${RAW_TOKEN}`),
	);

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(await response.json(), { valid: true });
	assert.deepStrictEqual(findByTokenCalls, [auth.hashToken(RAW_TOKEN)]);
});

test("GET reports an unknown link as invalid", async () => {
	tokenRecord = null;

	const response = await GET(
		new Request(`http://localhost/api/auth/reset-password?token=${RAW_TOKEN}`),
	);

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(await response.json(), { valid: false });
});

test("GET reports an expired link as invalid", async () => {
	tokenRecord = {
		...liveToken(),
		expires: new Date(Date.now() - 1000),
	};

	const response = await GET(
		new Request(`http://localhost/api/auth/reset-password?token=${RAW_TOKEN}`),
	);

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(await response.json(), { valid: false });
});

test("GET reports a missing token as invalid without a lookup", async () => {
	const response = await GET(
		new Request("http://localhost/api/auth/reset-password"),
	);

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(await response.json(), { valid: false });
	assert.deepStrictEqual(findByTokenCalls, []);
});
