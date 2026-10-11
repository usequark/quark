import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files.
// `forgot-password/` is 5 levels below apps/web (auth → api → app → src → web),
// so `src/lib/` is 4 levels up from here.
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds.

const db = await import("@usequark/quark-db");

/** The row `user.findByEmail` resolves to, or null for an unknown address. */
let account;
/** Every address passed to `user.findByEmail`. */
let findByEmailCalls;

mock.module("@usequark/quark-db", {
	namedExports: {
		...db,
		user: {
			findByEmail: async (email) => {
				findByEmailCalls.push(email);
				return account;
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

const sendUrl = pathToFileURL(
	new URL("../../../../lib/send-reset-password-email.js", import.meta.url)
		.pathname,
).href;

/** Every account `sendResetPasswordEmail` was handed, in order. */
let sendCalls;
/** When set, `sendResetPasswordEmail` rejects with this error. */
let sendError;

mock.module(sendUrl, {
	namedExports: {
		sendResetPasswordEmail: async (accountParam) => {
			if (sendError) throw sendError;
			sendCalls.push(accountParam);
		},
	},
});

const { POST } = await import("./route.js");

/** A forgot-password request carrying the headers a CSRF-protected POST needs. */
function forgotRequest(body = { email: "existing@example.com" }) {
	return new Request("http://localhost/api/auth/forgot-password", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: "csrf_token=test-csrf-token",
			"x-csrf-token": "test-csrf-token",
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

function resetFixtures() {
	account = {
		id: "user-1",
		email: "existing@example.com",
		name: "Existing",
		password: "hashed:old",
	};
	findByEmailCalls = [];
	sendCalls = [];
	sendError = null;
}

beforeEach(() => {
	resetFixtures();
});

afterEach(() => {
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("POST sends a reset link for a registered address", async () => {
	const response = await POST(forgotRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(findByEmailCalls, ["existing@example.com"]);
	assert.deepStrictEqual(sendCalls, [
		{
			id: "user-1",
			email: "existing@example.com",
			name: "Existing",
			password: "hashed:old",
		},
	]);
});

test("POST answers identically for an unknown address", async () => {
	account = null;

	const unknown = await POST(forgotRequest());
	const known = await POST(forgotRequest());

	// Same status, same body. Any divergence is an email-enumeration oracle —
	// the "check your inbox" vs "no such account" distinction is exactly what a
	// scraper probing for registered mailboxes is collecting.
	assert.strictEqual(unknown.status, 200);
	assert.strictEqual(known.status, 200);
	assert.deepStrictEqual(await unknown.json(), await known.json());
	assert.deepStrictEqual(sendCalls, []);
});

test("POST never surfaces a send failure for a registered address", async () => {
	sendError = new Error("connect ECONNREFUSED redis://cache:6379");

	const response = await POST(forgotRequest());
	const body = await response.json();

	// The address is real and the caller must not learn that from an error
	// that only happens for real addresses. The failure is the operator's to
	// find in the logs, not the caller's to read off the response.
	assert.strictEqual(response.status, 200);
	assert.ok(body.message.includes("If that email address has an account"));
	assert.ok(!body.message.includes("ECONNREFUSED"));
});

test("POST returns 400 for an unvalidated email before any lookup", async () => {
	const response = await POST(forgotRequest({ email: "not-an-email" }));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.code, "VALIDATION_ERROR");
	// `findByEmail` must not be reachable as an oracle with an unvalidated
	// address, and a malformed body must not start a lookup at all.
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(sendCalls, []);
});

test("POST returns 400 for a missing body", async () => {
	const response = await POST(forgotRequest(""));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.name, "ValidationError");
	assert.deepStrictEqual(findByEmailCalls, []);
});

test("POST rejects a cross-site request that carries no CSRF token", async () => {
	const response = await POST(
		new Request("http://localhost/api/auth/forgot-password", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "existing@example.com" }),
		}),
	);

	assert.strictEqual(response.status, 401);
	// No lookup, no email: the address is never even checked.
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(sendCalls, []);
});

test("POST turns a thrown error into a response instead of propagating it", async () => {
	// Simulate a database outage surfacing as a handled error type.
	const coreModule = await import("@usequark/quark-core/errors");
	account = null;

	await mock.module("@usequark/quark-db", {
		namedExports: {
			...db,
			user: {
				findByEmail: async () => {
					throw new coreModule.AppError(
						"Database unavailable",
						503,
						"DATABASE_UNAVAILABLE",
					);
				},
			},
		},
	});

	// Re-import after re-mocking so the handler picks up the new binding.
	const { POST: ReloadedPOST } = await import("./route.js?t=reload");
	const response = await ReloadedPOST(forgotRequest());

	assert.strictEqual(response.status, 503);
	assert.strictEqual((await response.json()).code, "DATABASE_UNAVAILABLE");
});
