import assert from "node:assert";
import { register } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// Resolve the @/ alias used by the route file.
// `[...nextauth]/` is 5 levels below apps/web (auth → api → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Both are registered at module scope, before `./route.js` is imported. `import()`
// caches after the first call, so a later `mock.module` would not reach the bindings
// the route already holds.
//
// The route's job is to hand a request to the right `handlers` member, having first
// passed it through `normalizeAuthRequest`. Both halves are replaced by identity
// markers, so every assertion below can tell "the route did this" from "the real
// implementation happened to produce something plausible".

/** Stands in for `normalizeAuthRequest`'s return value. */
const NORMALIZED = {
	url: "http://normalized.example/session",
	marker: "normalized",
};

let normalizeCalls = [];

/** Response returned by each `handlers` member, distinct per method. */
const HANDLER_RESPONSES = {
	GET: new Response("from-handlers-get", { status: 201 }),
	POST: new Response("from-handlers-post", { status: 202 }),
};

let handlerCalls = [];

function makeHandler(method) {
	return mock.fn(async (...args) => {
		handlerCalls.push({ method, args });
		return HANDLER_RESPONSES[method];
	});
}

const normalizeAuthRequestUrl = pathToFileURL(
	new URL("../../../../lib/normalize-auth-request.js", import.meta.url)
		.pathname,
).href;

const authUrl = pathToFileURL(
	new URL("../../../../lib/auth.js", import.meta.url).pathname,
).href;

// Deliberately synchronous. The real `normalizeAuthRequest` is a sync function
// returning a Request, and the route does not `await` its result — an async mock
// would return a Promise and the tests below would be asserting against the wrong
// shape without noticing.
mock.module(normalizeAuthRequestUrl, {
	namedExports: {
		normalizeAuthRequest: (request) => {
			normalizeCalls.push(request);
			return NORMALIZED;
		},
	},
});

mock.module(authUrl, {
	namedExports: {
		handlers: {
			GET: makeHandler("GET"),
			POST: makeHandler("POST"),
		},
	},
});

const { GET, POST } = await import("./route.js");

/** A plain request. Distinct per test so identity assertions are meaningful. */
function makeRequest(path = "/api/auth/session", init = {}) {
	return new Request(`http://localhost${path}`, init);
}

function resetFixtures() {
	normalizeCalls = [];
	handlerCalls = [];
}

// ── Tests ────────────────────────────────────────────────────────────────────

test("GET /api/auth/[...nextauth] delegates to handlers.GET", async () => {
	resetFixtures();
	const request = makeRequest();
	const context = { params: Promise.resolve({ nextauth: ["session"] }) };

	const response = await GET(request, context);

	// The return value is passed straight back to Next.js. The route adds nothing.
	assert.strictEqual(response, HANDLER_RESPONSES.GET);
	assert.deepStrictEqual(handlerCalls, [
		{ method: "GET", args: [NORMALIZED, context] },
	]);
});

test("POST /api/auth/[...nextauth] delegates to handlers.POST", async () => {
	resetFixtures();
	const request = makeRequest("/api/auth/callback/credentials", {
		method: "POST",
	});
	const context = {
		params: Promise.resolve({ nextauth: ["callback", "credentials"] }),
	};

	const response = await POST(request, context);

	assert.strictEqual(response, HANDLER_RESPONSES.POST);
	assert.deepStrictEqual(handlerCalls, [
		{ method: "POST", args: [NORMALIZED, context] },
	]);
});

test("GET passes the request through normalizeAuthRequest before delegating", async () => {
	resetFixtures();
	const request = makeRequest();

	await GET(request, { params: Promise.resolve({ nextauth: ["session"] }) });

	// One call, and it received the request Next.js handed the route — not the
	// normalized replacement, which is the whole point of the adapter.
	assert.strictEqual(normalizeCalls.length, 1);
	assert.strictEqual(normalizeCalls[0], request);
});

test("POST passes the request through normalizeAuthRequest before delegating", async () => {
	resetFixtures();
	const request = makeRequest("/api/auth/callback/credentials", {
		method: "POST",
	});

	await POST(request, { params: Promise.resolve({ nextauth: ["callback"] }) });

	assert.strictEqual(normalizeCalls.length, 1);
	assert.strictEqual(normalizeCalls[0], request);
});

test("the handlers receive the normalized request, not the raw one", async () => {
	resetFixtures();
	const request = makeRequest();

	await GET(request, { params: Promise.resolve({ nextauth: ["session"] }) });

	// Guards against a route that normalizes for its own use but hands the original
	// request on anyway. Strictly unequal identities, not a field comparison.
	assert.notStrictEqual(handlerCalls[0].args[0], request);
	assert.strictEqual(handlerCalls[0].args[0], NORMALIZED);
});

test("the route does not leak one method's normalized request into the other", async () => {
	resetFixtures();
	const getRequest = makeRequest("/api/auth/session");
	const postRequest = makeRequest("/api/auth/signin/credentials", {
		method: "POST",
	});

	await GET(getRequest, { params: Promise.resolve({ nextauth: ["session"] }) });
	await POST(postRequest, {
		params: Promise.resolve({ nextauth: ["signin"] }),
	});

	assert.strictEqual(normalizeCalls.length, 2);
	assert.strictEqual(normalizeCalls[0], getRequest);
	assert.strictEqual(normalizeCalls[1], postRequest);
});

test("the route forwards the route context untouched", async () => {
	resetFixtures();
	const context = { params: Promise.resolve({ nextauth: ["session"] }) };

	await GET(makeRequest(), context);

	// Next.js resolves `params` to a Promise. The route must not await, unwrap or
	// rebuild it, or the handler would lose the segment.
	assert.strictEqual(handlerCalls[0].args[1], context);
});
