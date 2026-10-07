import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files.
// `apple/` is 5 levels below apps/web (apple → auth → api → app → src → web), so
// the loader is 5 levels up and `src/lib/` is 4.
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is
// cached after the first call, so a later `mock.module` would not reach the
// bindings the route already holds.
//
// Apple is reached at three boundaries and each is mocked separately, because
// each is a decision the route makes rather than a thing it inherits:
//   · `fetch`         — the JWKS lookup, and the exact URL it asks for
//   · `jose`          — key import + signature/issuer verification
//   · `issueTokenPair`— the minting step, so "the route verified the token" is
//                       distinguishable from "the route passed the right user on"

const jwtUrl = pathToFileURL(
	new URL("../../../../lib/jwt.js", import.meta.url).pathname,
).href;

/** Every boundary the route crossed, in order. */
let steps;
/** Every URL passed to `fetch`, in order. */
let fetchUrls;

/** The JWKS body Apple returns for the current test. */
let appleKeys;
/** The HTTP status the JWKS response carries. */
let keysStatus;
/** When set, the JWKS request rejects with this error. */
let keysError;

/** The payload `jwtVerify` resolves to for the current test. */
let verifiedPayload;
/** When set, `jwtVerify` rejects — a bad signature, a wrong issuer, an expiry. */
let verifyError;

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

/**
 * Stands in for `jose`.
 *
 * Only the two functions the route imports are replaced, and both record what
 * they were handed: `importJWK` proves *which* of Apple's keys was chosen, and
 * `jwtVerify` proves the token and the constraints it was verified under.
 */
mock.module("jose", {
	namedExports: {
		importJWK: async (jwk, alg) => {
			steps.push(`importJWK:${jwk.kid}`);
			return { key: `public-key-for-${jwk.kid}`, alg };
		},
		jwtVerify: async (token, key, options) => {
			steps.push(`jwtVerify:${key.key}`);
			verifyCalls.push({ token, key, options });
			if (verifyError) throw verifyError;
			return { payload: verifiedPayload };
		},
	},
});

/** Every call `jwtVerify` received, for the current test. */
let verifyCalls;

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

/** Apple's published JWKS. `KID_OLD` is the key this suite signs nothing with. */
const APPLE_KEYS = [
	{ kid: "KID_OLD", kty: "RSA", alg: "RS256", n: "old-n", e: "AQAB" },
	{ kid: "KID_LIVE", kty: "RSA", alg: "RS256", n: "live-n", e: "AQAB" },
];

/** The payload `jwtVerify` resolves to for a genuine Apple identity token. */
const VALID_PAYLOAD = {
	iss: "https://appleid.apple.com",
	aud: "com.example.service",
	email: "alice@icloud.com",
	sub: "apple-sub-001",
	email_verified: "true",
	name: { firstName: "Alice", lastName: "Liddell" },
};

/** The row `user.create` returns for a first-time Apple sign-in. */
const CREATED = {
	id: "user-apple",
	email: "alice@icloud.com",
	name: "Alice Liddell",
	role: "viewer",
};

const { POST } = await import("./route.js");

/**
 * A JWT with the given header, so the `kid` the route reads is real.
 *
 * Only the header segment matters to the route — the signature and payload
 * segments are never decoded here, because `jwtVerify` is the mock. The header
 * must still be genuine base64url JSON or the route cannot parse it.
 */
function identityToken(header = { kid: "KID_LIVE", alg: "RS256" }) {
	const encode = (value) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode(header)}.payload.signature`;
}

/** An Apple sign-in request carrying the given body. */
function appleRequest(body = { identityToken: identityToken() }) {
	return new Request("http://localhost/api/auth/apple", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

function resetFixtures() {
	steps = [];
	fetchUrls = [];
	verifyCalls = [];
	appleKeys = APPLE_KEYS;
	keysStatus = 200;
	keysError = null;
	verifiedPayload = { ...VALID_PAYLOAD };
	verifyError = null;
	existingUser = null;
	createdUser = CREATED;
	createError = null;
	createCalls = [];
	findByEmailCalls = [];
	issueCalls = [];
	issueError = null;
}

let originalFetch;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	resetFixtures();

	globalThis.fetch = async (url) => {
		steps.push("fetchKeys");
		fetchUrls.push(url);
		if (keysError) throw keysError;
		return new Response(JSON.stringify({ keys: appleKeys }), {
			status: keysStatus,
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
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("POST /api/auth/apple exchanges a valid identity token for our own token pair", async () => {
	const response = await POST(appleRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.token, "issued.access.token");
	assert.strictEqual(body.refreshToken, "issued.refresh.token");
	assert.strictEqual(body.expiresAt, "2026-10-07T12:00:00.000Z");
	// The whole point of the route. Anything else in the body would be the route
	// inventing session state of its own.
	assert.deepStrictEqual(Object.keys(body), [
		"token",
		"refreshToken",
		"expiresAt",
	]);
});

test("POST fetches Apple's key set from the published JWKS URL", async () => {
	await POST(appleRequest());

	// Verification is only as good as where the key came from. A key fetched from
	// anywhere else — a cache, a config value, a second host — is a key the route
	// chose rather than one Apple published.
	assert.deepStrictEqual(fetchUrls, ["https://appleid.apple.com/auth/keys"]);
});

test("POST picks the key whose kid matches the identity token header", async () => {
	await POST(
		appleRequest({ identityToken: identityToken({ kid: "KID_LIVE" }) }),
	);

	// `keys[0]` would import KID_OLD. Picking the wrong key fails verification in
	// production, so the selection itself is what needs pinning.
	assert.deepStrictEqual(steps, [
		"fetchKeys",
		"importJWK:KID_LIVE",
		"jwtVerify:public-key-for-KID_LIVE",
		"findByEmail:alice@icloud.com",
		"create",
		"issueTokenPair",
	]);
});

test("POST imports the matched key as RS256 and verifies under Apple's issuer", async () => {
	await POST(appleRequest());

	assert.strictEqual(verifyCalls.length, 1);
	// The raw token, not the header the route decoded for itself.
	assert.strictEqual(verifyCalls[0].token, identityToken());
	assert.deepStrictEqual(verifyCalls[0].key, {
		key: "public-key-for-KID_LIVE",
		alg: "RS256",
	});
	// The issuer constraint is the whole reason this is not just "decoded a
	// token". Without it any Apple-signed token from any tenant would be
	// accepted here, since the keys are shared across every Sign in with Apple
	// deployment.
	assert.deepStrictEqual(verifyCalls[0].options, {
		issuer: "https://appleid.apple.com",
	});
});

test("POST takes the email from the verified payload, not the body", async () => {
	// Body-supplied identity is a complete account-takeover primitive: anyone
	// holding a valid identity token for *their own* Apple account would be able
	// to mint a session for any address they name.
	const response = await POST(
		appleRequest({
			identityToken: identityToken(),
			email: "admin@example.com",
			sub: "apple-sub-999",
		}),
	);

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(findByEmailCalls, ["alice@icloud.com"]);
	assert.strictEqual(createCalls[0].email, "alice@icloud.com");
});

test("POST verifies the signature before it touches the database", async () => {
	// The ordering is the fix. A database read before verification would make
	// this endpoint an unauthenticated oracle over the user table: anyone could
	// submit a garbage identity token and learn, from the response, whether an
	// address is registered.
	const response = await POST(appleRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(steps, [
		"fetchKeys",
		"importJWK:KID_LIVE",
		"jwtVerify:public-key-for-KID_LIVE",
		"findByEmail:alice@icloud.com",
		"create",
		"issueTokenPair",
	]);
});

test("POST returns 500 rather than 401 when Apple's key set is unreachable", async () => {
	// The signature was never checked — the key it would be checked against never
	// arrived. Answering 401 tells the mobile client the user should
	// re-authenticate, discarding a perfectly good Apple session because our own
	// network to appleid.apple.com blipped.
	keysError = new Error("fetch failed: ETIMEDOUT");

	const response = await POST(appleRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST surfaces a failing JWKS response as 500, not as an invalid token", async () => {
	// Apple answering with an HTTP error and a body that carries no `keys` must
	// not be reported to the client as "your Apple token is invalid". A
	// `!keysResponse.ok → 401` shortcut here would tell every user with a valid
	// Apple session to re-authenticate because Apple had a bad minute.
	keysStatus = 503;
	appleKeys = undefined;

	const response = await POST(appleRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns 401 and verifies nothing when Apple publishes no key for the token's kid", async () => {
	// This is the key-rotation case: Apple rotates, the client's token carries the
	// old kid, and there is no key to check the signature against. It must be
	// rejected, not verified against whatever key happens to be first.
	const response = await POST(
		appleRequest({ identityToken: identityToken({ kid: "KID_RETIRED" }) }),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid Apple token: no matching key");
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST returns 401 and reads no database when the token fails verification", async () => {
	// One 401 for a bad signature, a wrong issuer and an expiry alike. The route
	// cannot tell them apart and must not: distinguishing them tells a caller
	// which check to work around.
	verifyError = new Error("signature verification failed");

	const response = await POST(appleRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.message, "Invalid Apple token");
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST does not echo the verification error or the token in the 401 body", async () => {
	verifyError = new Error(
		"signature verification failed for eyJhbGciOi.SUPERSECRET",
	);

	const response = await POST(appleRequest());
	const raw = await response.text();

	// The identity token is a bearer credential and the jose message is
	// attacker-influenced. Neither belongs in a response body.
	assert.ok(!raw.includes("SUPERSECRET"), `401 body echoed the token: ${raw}`);
	assert.deepStrictEqual(JSON.parse(raw), { message: "Invalid Apple token" });
});

test("POST returns 400 and creates nothing when the verified token carries no email", async () => {
	verifiedPayload = { iss: "https://appleid.apple.com", sub: "apple-sub-001" };

	const response = await POST(appleRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.message, "Apple token does not contain an email");
	// An account created from an empty email would be unreachable and would squat
	// the row, so the failure has to land before the write.
	assert.deepStrictEqual(findByEmailCalls, []);
	assert.deepStrictEqual(createCalls, []);
	assert.deepStrictEqual(issueCalls, []);
});

test("POST signs in an existing user without creating a second row", async () => {
	existingUser = {
		id: "user-1",
		email: "alice@icloud.com",
		name: "Alice Liddell",
	};

	const response = await POST(appleRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(createCalls, []);
	// The token must be minted for the row already in the database. Re-creating
	// would hand out a token for a new id and silently fork the account.
	assert.deepStrictEqual(issueCalls, [existingUser]);
});

test("POST creates the user on first sign-in with the name from the token", async () => {
	const response = await POST(appleRequest());

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(createCalls, [
		{ email: "alice@icloud.com", name: "Alice Liddell" },
	]);
	// The created row, not the payload that created it, is the account the token
	// is minted for — the id and role only exist on the row.
	assert.deepStrictEqual(issueCalls, [CREATED]);
});

test("POST builds the name from whichever half of the Apple name claim is present", async () => {
	// Apple sends a one-time `user` object on first authorisation only, and it is
	// routinely half-populated. A `${first} ${last}` that skipped the fallbacks
	// would persist the literal string "undefined" as a user's name.
	verifiedPayload = {
		...VALID_PAYLOAD,
		name: { lastName: "Liddell" },
	};
	await POST(appleRequest());
	assert.strictEqual(createCalls[0].name, "Liddell");

	resetFixtures();
	verifiedPayload = { ...VALID_PAYLOAD, name: { firstName: "Alice" } };
	await POST(appleRequest());
	assert.strictEqual(createCalls[0].name, "Alice");
});

test("POST stores a null name when Apple sends no name claim at all", async () => {
	// Apple omits `name` entirely on every sign-in after the first, so this is the
	// common path, not an edge case. `undefined` in a Prisma `data` and an
	// explicit null are not the same statement on every client.
	verifiedPayload = { ...VALID_PAYLOAD };
	delete verifiedPayload.name;

	await POST(appleRequest());

	assert.deepStrictEqual(createCalls, [
		{ email: "alice@icloud.com", name: null },
	]);
});

test("POST returns 400 for a missing identityToken without fetching Apple", async () => {
	const response = await POST(appleRequest({}));
	const body = await response.json();

	assert.strictEqual(response.status, 400);
	assert.strictEqual(body.code, "VALIDATION_ERROR");
	// Schema first: an absent token must be rejected by the route, not turned
	// into an outbound request to Apple.
	assert.deepStrictEqual(fetchUrls, []);
	assert.deepStrictEqual(findByEmailCalls, []);
});

test("POST returns 400 for an empty identityToken without fetching Apple", async () => {
	const response = await POST(appleRequest({ identityToken: "" }));

	assert.strictEqual(response.status, 400);
	assert.deepStrictEqual(fetchUrls, []);
});

test("POST returns 400 for a body that is not JSON", async () => {
	const response = await POST(appleRequest("{not json"));
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

	const response = await POST(appleRequest());
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
	// would send a valid Apple user back to the login screen for a server fault.
	issueError = new Error("NEXTAUTH_SECRET not configured");

	const response = await POST(appleRequest());

	assert.strictEqual(response.status, 500);
});

test("POST turns a thrown error into a response instead of propagating it", async () => {
	// `handleError` has to be reached from every branch in the try, or a handled
	// failure becomes an unhandled rejection in the Next.js request path.
	createError = new Error("prisma exploded");

	const response = await POST(appleRequest());

	assert.strictEqual(response.status, 500);
	assert.deepStrictEqual(
		JSON.parse(await response.text()).code,
		"INTERNAL_ERROR",
	);
});

test("POST currently verifies no audience and no nonce", async () => {
	// KNOWN GAP, not intended behaviour. The schema accepts a `nonce` and the
	// route ignores it, and `jwtVerify` is called with an issuer constraint but no
	// `audience`. Apple's `aud` is the bundle id / service id the identity token
	// was minted for, and the nonce is what binds a token to the one sign-in
	// attempt that requested it — Apple's whole replay defence. Together, a token
	// Apple issued to another app for the same Apple ID is accepted here and can
	// be replayed indefinitely, because `iss` and the signature are the only
	// things checked. Recorded so the gap is visible; expected to be inverted
	// once APPLE_CLIENT_ID is wired in.
	const response = await POST(
		appleRequest({
			identityToken: identityToken(),
			nonce: "client-supplied-nonce",
		}),
	);

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(verifyCalls[0].options, {
		issuer: "https://appleid.apple.com",
	});
	assert.deepStrictEqual(createCalls, [
		{ email: "alice@icloud.com", name: "Alice Liddell" },
	]);
});
