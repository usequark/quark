import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by route files.
// `csrf/` is 4 levels below apps/web (csrf → api → app → src → web).
register(new URL("../../../../scripts/test-alias-loader.mjs", import.meta.url));

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is cached
// after the first call, so a later `mock.module` would not reach the bindings the
// route already holds.
//
// `@/lib/auth` is replaced wholesale: the real module builds a NextAuth instance at
// first use and imports the Prisma adapter, none of which belongs in a test of this
// 40-line route. `getCsrfCookieOptions` is *not* mocked — what this route does with
// it is half the behaviour under test.

const authUrl = pathToFileURL(
	new URL("../../../lib/auth.js", import.meta.url).pathname,
).href;

/** What `auth()` resolves to for the current test; null means no session. */
let session;
/** When set, `auth()` rejects with this error instead. */
let authError;

mock.module(authUrl, {
	namedExports: {
		auth: async () => {
			if (authError) throw authError;
			return session;
		},
	},
});

const core = await import("@usequark/quark-core");

/** How many times the route asked for a token. */
let tokenCalls;

// Delegates to the real generator so the token under test is genuinely random — a
// stubbed constant would make "a fresh token per request" untestable. The wrapper
// exists to make *that* generation observable: the response body alone cannot show
// whether a token was minted and then discarded.
mock.module("@usequark/quark-core", {
	namedExports: {
		...core,
		generateCsrfToken: () => {
			tokenCalls++;
			return core.generateCsrfToken();
		},
	},
});

const SESSION = { user: { id: "user-1", email: "alice@example.com" } };

const { GET } = await import("./route.js");

/** A GET to /api/csrf, optionally behind a forwarded https proxy. */
function csrfRequest(headers = {}) {
	return new Request("http://localhost/api/csrf", { headers });
}

/**
 * Parse the single Set-Cookie the route writes into its parts.
 *
 * Returns null when the response sets no cookie at all — which is itself an
 * assertion several tests below rely on.
 */
function readSetCookie(response) {
	const header = response.headers.get("set-cookie");
	if (!header) return null;

	const [pair, ...attributes] = header.split("; ");
	const separator = pair.indexOf("=");
	const attrs = {};
	for (const attribute of attributes) {
		const [key, ...rest] = attribute.split("=");
		// Attribute names are case-insensitive and Next.js emits its own casing
		// (`SameSite=strict`), so the lookup is normalized rather than pinning a
		// serializer's spelling.
		attrs[key.toLowerCase()] = rest.join("=");
	}

	return {
		name: pair.slice(0, separator),
		// The serialized value is percent-encoded; callers compare against the
		// decoded token so the comparison is against the real value, not its wire form.
		value: decodeURIComponent(pair.slice(separator + 1)),
		rawValue: pair.slice(separator + 1),
		has: (flag) => attributes.includes(flag),
		attr: (key) => attrs[key],
	};
}

beforeEach(() => {
	session = { ...SESSION };
	authError = null;
	tokenCalls = 0;
});

afterEach(() => {
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("GET /api/csrf returns a token and stores that same token in the cookie", async () => {
	const response = await GET(csrfRequest());
	const body = await response.json();
	const cookie = readSetCookie(response);

	assert.strictEqual(response.status, 200);
	assert.deepStrictEqual(Object.keys(body), ["csrfToken"]);
	// The server compares the cookie against the `x-csrf-token` header on every
	// mutating request. If these two ever diverge, *every* subsequent write fails
	// with "Invalid CSRF token" and the failure looks like a client bug.
	assert.strictEqual(cookie.name, "csrf_token");
	assert.strictEqual(cookie.value, body.csrfToken);
});

test("the cookie is httpOnly, SameSite=Strict, and scoped to the whole site", async () => {
	const cookie = readSetCookie(await GET(csrfRequest()));

	// httpOnly: the token must not be readable from `document.cookie`, or any XSS
	// on the site can read it and forge authenticated writes.
	assert.ok(
		cookie.has("HttpOnly"),
		`cookie is not HttpOnly: ${cookie.rawValue}`,
	);
	// SameSite=Strict: a cross-site form post must not carry the cookie along.
	assert.strictEqual(cookie.attr("samesite").toLowerCase(), "strict");
	// Path=/: /api/csrf sets the cookie and /api/* are the routes that read it. A
	// narrower path (or a missing one) silently stops it reaching those requests.
	assert.strictEqual(cookie.attr("path"), "/");
	// Bounded lifetime: an unbounded cookie would keep a live CSRF secret in the
	// browser indefinitely.
	assert.ok(
		Number(cookie.attr("max-age")) <= 3600,
		`csrf cookie should not outlive an hour: ${cookie.attr("max-age")}`,
	);
});

test("the Secure flag follows the request's protocol, not a fixed value", async () => {
	// Behind a TLS-terminating proxy the request Next.js sees is plain http, so the
	// decision has to come from `x-forwarded-proto`. This is what proves the route
	// hands `request` to `getCsrfCookieOptions` instead of a baked-in object.
	const secure = readSetCookie(
		await GET(csrfRequest({ "x-forwarded-proto": "https" })),
	);
	const insecure = readSetCookie(
		await GET(csrfRequest({ "x-forwarded-proto": "http" })),
	);

	assert.ok(secure.has("Secure"), "forwarded https request got no Secure flag");
	assert.ok(
		!insecure.has("Secure"),
		"forwarded http request got a Secure flag",
	);
});

test("each request mints a new token rather than returning a stable one", async () => {
	const first = await (await GET(csrfRequest())).json();
	const second = await (await GET(csrfRequest())).json();

	// A stable token would be reusable indefinitely, so a single leak (a shared URL,
	// a proxy log, a support screenshot) compromises every later request. Both
	// calls are counted because the difference has to come from *this* route
	// calling the generator, not from the generator being random.
	assert.strictEqual(tokenCalls, 2);
	assert.notStrictEqual(first.csrfToken, second.csrfToken);
});

test("GET returns 401, mints nothing and sets no cookie when there is no session", async () => {
	session = null;

	const response = await GET(csrfRequest());
	const body = await response.json();

	assert.strictEqual(response.status, 401);
	assert.strictEqual(body.error, "Unauthorized");
	// A token handed to an unauthenticated caller is a forgeable write credential:
	// it would be cached by an intermediate proxy and replayed after login.
	assert.strictEqual(
		tokenCalls,
		0,
		"a token was minted for an unauthenticated request",
	);
	assert.strictEqual(
		response.headers.get("set-cookie"),
		null,
		"an unauthenticated response set a csrf_token cookie",
	);
});

test("a failure inside the handler becomes a 500 that leaks no detail", async () => {
	authError = new Error(
		"PrismaClientInitializationError: DATABASE_URL is not set",
	);

	const response = await GET(csrfRequest());
	const raw = await response.text();

	assert.strictEqual(response.status, 500);
	// Connection strings and driver internals are how a probe maps the deployment.
	assert.ok(
		!raw.includes("DATABASE_URL"),
		`500 body leaked the underlying failure: ${raw}`,
	);
	assert.deepStrictEqual(JSON.parse(raw), {
		error: "Failed to generate CSRF token",
	});
});

test("the 500 path is not a general catch-all for a missing session", async () => {
	// `auth()` returning null is an ordinary outcome (signed out, expired cookie)
	// and must stay a 401. Only a thrown error is a 500 — conflating the two would
	// send every signed-out visitor's client down a retry-on-500 path.
	session = null;

	const response = await GET(csrfRequest());

	assert.strictEqual(response.status, 401);
});
