import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files.
// `google/` is 5 levels below apps/web (google → auth → api → app → src → web),
// so the loader is 5 levels up and `src/lib/` is 4.
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds.
//
// Google's `tokeninfo` endpoint is mocked at `globalThis.fetch` rather than as
// a module: it is the network boundary, and pinning the exact URL the route
// builds is part of what this suite is for. `issueTokenPair` is mocked so the
// suite can tell "the route minted a token" from "the route handed the right
// user to the minter".

const jwtUrl = pathToFileURL(
	new URL("../../../../lib/jwt.js", import.meta.url).pathname,
).href;

/** Every boundary the route crossed, in order. */
let steps;
/** Every URL passed to `fetch`, in order. */
let fetchUrls;

/** The tokeninfo payload for the current test. */
let tokenInfo;
/** When set, the response body is this raw string instead of JSON. */
let tokenInfoRaw;
/** The HTTP status the tokeninfo response carries. */
let tokenInfoStatus;
/** When set, the tokeninfo request rejects with this error. */
let tokenInfoError;
/** The row `user.findByEmail` resolves to, or null for a first-time sign-in. */
let existingUser;
/** The row `user.create` resolves to. */
let createdUser;
/** When set, `user.create` rejects with this error instead. */
let createError;
/** Every payload `user.create` was handed. */
let createCalls;
/** Every email `user.findByEmail` was asked about. */
let findByEmailCalls;
/** Every user record `issueTokenPair` was handed. */
let issueCalls;
/** When set, `issueTokenPair` rejects with this error instead. */
let issueError;

mock.module(jwtUrl, {
	namedExports: {
		issueTokenPair: async (user) => {
			steps.push("issueTokenPair");
			issueCalls.push(user);
			if (issueError) throw issueError;
			return {
				token: "issued.access.token",
				refreshToken: "issued.refresh.token",
				expiresAt: "2026-10-07T12:00:00.000Z",
			};
		},
	},
});

// `userRegisterSchema` is the real one: the point of the validation tests is
// that this route applies *that* schema, and a stubbed schema would make them
// pass by construction.
mock.module("@usequark/quark-db", {
	namedExports: {
		user: {
			findByEmail: async (email) => {
				steps.push(`findByEmail:${email}`);
				findByEmailCalls.push(email);
				return existingUser;
			},
			create: async (data) => {
				steps.push("create");
				createCalls.push(data);
				if (createError) throw createError;
				return { ...createdUser };
			},
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

/** The row `user.create` returns for a first-time Google sign-in. */
const CREATED = {
	id: "user-google",
	email: "alice@example.com",
	name: "Alice",
	role: "viewer",
};

/**
 * The client id this suite treats as configured.
 *
 * `VALID_TOKEN_INFO.aud` must equal it, or every happy-path test would be
 * exercising the audience-mismatch branch instead of the success path.
 */
const CLIENT_ID = "quark-client-id";

/** A tokeninfo body for a token Google accepted *for this app*. */
const VALID_TOKEN_INFO = {
	iss: "https://accounts.google.com",
	aud: CLIENT_ID,
	email: "alice@example.com",
	email_verified: "true",
	name: "Alice",
	sub: "google-sub-1",
};

const { POST } = await import("./route.js");

/** A Google sign-in request carrying the given body. */
function googleRequest(body = { idToken: "google.id.token" }) {
	return new Request("http://localhost/api/auth/google", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

function resetFixtures() {
	steps = [];
	fetchUrls = [];
	tokenInfo = { ...VALID_TOKEN_INFO };
	tokenInfoRaw = null;
	tokenInfoStatus = 200;
	tokenInfoError = null;
	existingUser = null;
	createdUser = CREATED;
	createError = null;
	createCalls = [];
	findByEmailCalls = [];
	issueCalls = [];
	issueError = null;
}

let originalFetch;
let originalClientId;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	originalClientId = process.env.GOOGLE_CLIENT_ID;
	process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
	resetFixtures();

	// The tokeninfo endpoint. Replaced rather than mocked per-test so `steps`
	// records the network call in sequence with the database calls.
	globalThis.fetch = async (url) => {
		steps.push("tokeninfo");
		fetchUrls.push(url);
		if (tokenInfoError) throw tokenInfoError;
		return new Response(tokenInfoRaw ?? JSON.stringify(tokenInfo), {
			status: tokenInfoStatus,
			headers: { "content-type": "application/json" },
		});
	};
});

afterEach(() => {
	if (originalFetch !== undefined) {
		globalThis.fetch = originalFetch;
	} else {
		delete globalThis.fetch;
	}
	if (originalClientId === undefined) {
		delete process.env.GOOGLE_CLIENT_ID;
	} else {
		process.env.GOOGLE_CLIENT_ID = originalClientId;
	}
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("POST /api/auth/google exchanges a valid id token for our own token pair", async () => {
	const response = await POST(googleRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.token, "issued.access.token");
	assert.strictEqual(body.refreshToken, "issued.refresh.token");
	assert.strictEqual(body.expiresAt, "2026-10-07T12:00:00.000Z");
	// The whole point of the route. A response carrying anything but the three
	// minted fields would be the route inventing session state of its own.
	assert.deepStrictEqual(Object.keys(body), [
		"token",
		"refreshToken",
		"expiresAt",
	]);
});

test("POST sends the id token to Google's tokeninfo endpoint, once", async () => {
	await POST(googleRequest({ idToken: "google.id.token" }));

	// The verification call is the security boundary of this route: the email
	// that becomes an account is whatever this URL answers with. A second call,
	// or a call to a different host, is a different (or absent) check.
	assert.deepStrictEqual(fetchUrls, [
		"https://oauth2.googleapis.com/tokeninfo?id_token=google.id.token",
	]);
});

test("POST takes the email from the verified tokeninfo response, not the body", async () => {
	// Body-supplied identity is a complete account-takeover primitive: anyone
	// holding a valid id token for *their own* Google account would be able to
	// mint a session for any address they name. The only legitimate source of
	// the email is Google's response.
	const response = await POST(
		googleRequest({
			idToken: "google.id.token",
			email: "admin@example.com",
			sub: "google-sub-1",
			email_verified: "true",
		}),
	);

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(findByEmailCalls, ["alice@example.com"]);
	assert.strictEqual(createCalls[0].email, "alice@example.com");
});

test("POST verifies the token before it touches the database", async () => {
	// The ordering is the fix. A database read before verification would make
	// this endpoint an unauthenticated oracle over the user table: anyone could
	// submit an invalid id token and learn, from the timing or the 409-vs-404,
	// whether an address is registered.
	existingUser = { id: "user-1", email: "alice@example.com" };
	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(steps, [
		"tokeninfo",
		"findByEmail:alice@example.com",
		"issueTokenPair",
	]);
});

test("POST returns 401 and reads no database when Google rejects the token", async () => {
	tokenInfoStatus = 400;
	tokenInfo = { error: "invalid_token" };

	const response = await POST(googleRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid Google token");
	// Google answering "no" must not become a lookup. If the lookup ran first the
	// response would differ for a known and an unknown address.
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST checks the status before it parses the body", async () => {
	// An error response from Google is frequently not JSON — a proxy 502, an HTML
	// error page. Parsing first would throw on `res.json()` and surface as a 500,
	// telling the mobile client our own gateway hiccup was its bad token.
	tokenInfoStatus = 502;
	tokenInfoRaw = "<html><body>502 Bad Gateway</body></html>";

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(findByEmailCalls, []);
});

test("POST does not echo Google's rejection detail back to the caller", async () => {
	tokenInfoStatus = 400;
	tokenInfo = {
		error: "invalid_token",
		error_description: "Invalid Value for id_token",
	};

	const response = await POST(googleRequest());
	const raw = await response.text();

	// Google's error text is attacker-influenced (it echoes what was submitted)
	// and the body is 401, so anything other than a fixed message here is a
	// reflection primitive and a hint about which token check failed.
	assert.deepStrictEqual(JSON.parse(raw), { message: "Invalid Google token" });
});

test("POST returns 500 rather than 401 when Google's tokeninfo is unreachable", async () => {
	// The signature was never checked. Answering 401 tells the mobile client the
	// user should re-authenticate, which discards a perfectly good Google
	// session because our own network blipped.
	tokenInfoError = new Error("fetch failed: ECONNREFUSED");

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns 400 and creates nothing when the verified token carries no email", async () => {
	tokenInfo = { iss: "https://accounts.google.com", aud: "quark-client-id" };

	const response = await POST(googleRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.message, "Google token does not contain an email");
	// An account created from an empty email would be unreachable and would
	// squat the row, so the failure has to land before the write.
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST signs in an existing user without creating a second row", async () => {
	existingUser = { id: "user-1", email: "alice@example.com", name: "Alice" };

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(createCalls, []);
	// The token must be minted for the row that is already in the database. A
	// route that re-created the user would hand out a token for a new id and
	// silently fork the account.
	assert.deepStrictEqual(issueCalls, [existingUser]);
});

test("POST creates the user on first sign-in with the name Google reports", async () => {
	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(createCalls, [
		{ email: "alice@example.com", name: "Alice" },
	]);
	// The created row, not the payload that created it, is the account the token
	// is minted for — the id and role only exist on the row.
	assert.deepStrictEqual(issueCalls, [CREATED]);
});

test("POST stores a null name when Google reports no name", async () => {
	tokenInfo = { ...VALID_TOKEN_INFO, name: undefined };

	await POST(googleRequest());

	// `name` is nullable in the schema, and `undefined` in a Prisma `data` is a
	// different statement from an explicit null on some clients. Pin the value
	// rather than the presence of the key.
	assert.deepStrictEqual(createCalls, [
		{ email: "alice@example.com", name: null },
	]);
});

test("POST returns 400 for a missing idToken without calling Google", async () => {
	const response = await POST(googleRequest({}));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.code, "VALIDATION_ERROR");
	// Schema first: an absent token must be rejected by the route, not turned
	// into an outbound request with `id_token=undefined` in it.
	assert.deepStrictEqual(fetchUrls, []);
	assert.deepStrictEqual(findByEmailCalls, []);
});

test("POST returns 400 for an empty idToken without calling Google", async () => {
	const response = await POST(googleRequest({ idToken: "" }));

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(fetchUrls, []);
});

test("POST returns 400 for a body that is not JSON", async () => {
	const response = await POST(googleRequest("{not json"));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.name, "ValidationError");
	assert.deepStrictEqual(fetchUrls, []);
});

test("POST returns 500 and mints nothing when the insert fails", async () => {
	createError = Object.assign(
		new Error("Unique constraint failed on the fields: (`email`)"),
		{ code: "P2002" },
	);

	const response = await POST(googleRequest());
	const raw = await response.text();

	assert.strictEqual(response.status, 500);
	// The error-handler fallback must not echo the driver's message: P2002
	// messages carry the column and the colliding value.
	assert.ok(
		!raw.includes("Unique constraint"),
		`error body leaked the database message: ${raw}`,
	);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns 500 and mints nothing when issuing the token fails", async () => {
	// Typically an unset NEXTAUTH_SECRET. The user exists at this point, so 401
	// would send a valid Google user back to the login screen for a server fault.
	issueError = new Error("NEXTAUTH_SECRET not configured");

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 500);
});

test("POST turns a thrown error into a response instead of propagating it", async () => {
	// `handleError` has to be reached from every branch in the try, or a handled
	// failure becomes an unhandled rejection in the Next.js request path.
	existingUser = null;
	createError = new Error("prisma exploded");

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(
		JSON.parse(await response.text()).code,
		"INTERNAL_ERROR",
	);
});

test("POST rejects a token Google minted for a different app", async () => {
	// The token is genuine and Google verified the signature — `tokeninfo`
	// returned 200. It was just issued to somebody else's OAuth client. Without the
	// audience comparison this is the whole attack: an attacker gets a victim to
	// sign in to any Google app they control, then posts that id token here. No
	// credential is ever stolen; the victim's own Google session is the weapon.
	tokenInfo = { ...VALID_TOKEN_INFO, aud: "some-other-apps-client-id" };

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 401);
	// Nothing may happen past the check: no row created, no token minted, and no
	// database read that would let a caller probe which addresses exist.
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST rejects a token with no audience claim at all", async () => {
	// `tokeninfo` omits `aud` on some shapes. A missing claim must not read as a
	// match — falling through to a truthy check here would accept any token whose
	// claims happen to omit it.
	tokenInfo = { ...VALID_TOKEN_INFO, aud: undefined };

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST refuses every request with 503 when no client id is configured", async () => {
	// This route is public: it does not need our frontend to call it, or anyone
	// to have set up Google sign-in. Leaving it serving while unconfigured would
	// mean accepting tokens with no audience check at all — strictly weaker than
	// the configured-but-wrong case above, which at least returns 401.
	delete process.env.GOOGLE_CLIENT_ID;

	const response = await POST(googleRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 503);
	assert.strictEqual(
		body.message,
		"Google sign-in is not configured on this server",
	);
	// Fail before the network entirely. Calling Google first and refusing after
	// would still tell an attacker this deployment is unconfigured, and would
	// depend on Google being reachable.
	assert.deepStrictEqual(fetchUrls, []);
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST treats a whitespace-only client id as unconfigured", async () => {
	// An operator clearing the variable in a dashboard leaves it present but
	// blank. Counting that as configured would compare every token against the
	// empty string and 401 every real sign-in, which reads as "Google is broken"
	// rather than "Google is off".
	process.env.GOOGLE_CLIENT_ID = "   ";

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 503);
	assert.deepStrictEqual(fetchUrls, []);
});

test("POST tolerates surrounding whitespace in the configured client id", async () => {
	// A trailing newline in a .env file or a Railway variable is routine. The
	// comparison trims, so this is a working deployment rather than a 401 on
	// every sign-in with nothing pointing at the cause.
	process.env.GOOGLE_CLIENT_ID = `  ${CLIENT_ID}  `;

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(issueCalls, [CREATED]);
});

test("POST does not say which check failed when the audience mismatches", async () => {
	// The body must stay identical to the generic invalid-token response. A
	// distinct message here tells an attacker their forged token was structurally
	// fine and only the audience was wrong, which is the useful bit of feedback
	// for tuning the forgery.
	tokenInfo = { ...VALID_TOKEN_INFO, aud: "some-other-apps-client-id" };

	const response = await POST(googleRequest());
	const raw = await response.text();

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(JSON.parse(raw), { message: "Invalid Google token" });
});

test("POST verifies the audience before it trusts the email in the same payload", async () => {
	// Ordering is the fix. Reading the email first and only then checking `aud`
	// would let a mismatched token's email reach `findByEmail`, turning the
	// response difference between a known and unknown address into a
	// registration oracle.
	tokenInfo = {
		...VALID_TOKEN_INFO,
		aud: "some-other-apps-client-id",
		email: "victim@example.com",
	};

	const response = await POST(googleRequest());

	assert.strictEqual(response.status, 401);
	assert.deepStrictEqual(findByEmailCalls, []);
});
