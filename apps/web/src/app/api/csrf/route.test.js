import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";

// Resolve the @/ alias used by route files.
// `csrf/` is 4 levels below apps/web (csrf → api → app → src → web).
register(new URL("../../../../scripts/test-alias-loader.mjs", import.meta.url));

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. `import()` is cached
// after the first call, so a later `mock.module` would not reach the bindings the
// route already holds.
//
// Only `@usequark/quark-core` is replaced, and only to make token *generation*
// observable and forceable — the response body alone cannot show whether a token
// was minted and then discarded, or whether the mint is what failed.
//
// `@/lib/auth` is deliberately NOT mocked, and the route deliberately does not
// import it; see the "no session dependency" test below.

const core = await import("@usequark/quark-core");

/** How many times the route asked for a token. */
let tokenCalls;
/** When set, the generator throws this instead of returning a token. */
let tokenError;

// Delegates to the real generator so the token under test is genuinely random — a
// stubbed constant would make "a fresh token per request" untestable. The wrapper
// exists to make *that* generation observable and to open the 500 path.
mock.module("@usequark/quark-core", {
	namedExports: {
		...core,
		generateCsrfToken: () => {
			tokenCalls++;
			if (tokenError) throw tokenError;
			return core.generateCsrfToken();
		},
	},
});

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

/**
 * Assert the response cannot be stored by any cache.
 *
 * The token in the body is a write credential, so a shared cache holding it
 * would let a second caller write as the first.
 */
function assertNotCacheable(response) {
	const cacheControl = response.headers.get("cache-control") || "";
	assert.match(
		cacheControl,
		/no-store/,
		`response is cacheable: Cache-Control is "${cacheControl}"`,
	);
	assert.match(
		response.headers.get("vary") || "",
		/cookie/i,
		"response does not Vary on Cookie",
	);
}

beforeEach(() => {
	tokenCalls = 0;
	tokenError = null;
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
	// This is the property that makes the double-submit check work for an
	// unauthenticated endpoint: the forgery arrives with no cookie to match.
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

test("GET mints a token for a caller with no session at all", async () => {
	// Registration is pre-authentication: the visitor on /auth/register has no
	// session and cannot have one. Gating this endpoint on a session made it
	// impossible for them to obtain the token that /api/auth/register then
	// requires, which is why that route's CSRF wrapper had to be inert.
	// The original 401-here guard was sound on its own terms — an uncacheable
	// token is the property that actually matters — and that property is now
	// enforced by headers rather than by refusing anonymous callers.
	const response = await GET(csrfRequest());
	const body = await response.json();
	const cookie = readSetCookie(response);

	assert.strictEqual(response.status, 200);
	assert.strictEqual(typeof body.csrfToken, "string");
	assert.ok(
		body.csrfToken.length > 0,
		"an anonymous caller got an empty token",
	);
	assert.strictEqual(cookie.value, body.csrfToken);
	assert.strictEqual(
		tokenCalls,
		1,
		"a token was not minted for an anonymous caller",
	);
});

test("no response from this route is cacheable", async () => {
	// A token body is a write credential. If a shared cache stored it, the next
	// caller through that cache would receive a token it could pair with a
	// cookie of its own — but the reverse case is the damaging one: a cached
	// response replayed to a caller who did not trigger the mint hands out a
	// credential that outlives the request that created it.
	assertNotCacheable(await GET(csrfRequest()));
});

test("the route reaches for no session at all", async () => {
	// Guard against reintroducing an `auth()` call here. The endpoint has to work
	// before sign-in, and reading a session needs the Prisma-backed Auth.js
	// instance — which turns a pre-auth page's CSRF fetch into a database
	// round-trip that can fail with a 500 for a visitor who simply has no
	// account. Asserted against the source because the alternative is a test that
	// fails somewhere deep inside Auth.js with an unrelated message.
	const source = await readFile(
		new URL("./route.js", import.meta.url),
		"utf-8",
	);

	assert.doesNotMatch(
		source,
		/from\s+["']@\/lib\/auth["']/,
		"the CSRF route imports the session module again",
	);
	assert.doesNotMatch(
		source,
		/\bauth\s*\(/,
		"the CSRF route calls auth() again",
	);
});

test("a failure inside the handler becomes a 500 that leaks no detail", async () => {
	tokenError = new Error(
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

test("the 500 path is uncacheable too", async () => {
	// The 500 still reports on a credential endpoint. Letting an intermediary
	// store *that* response is how a cached token ends up being served after the
	// underlying fault is gone.
	tokenError = new Error("entropy pool unavailable");

	assertNotCacheable(await GET(csrfRequest()));
});
