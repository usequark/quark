import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { clearCsrfToken, getCsrfToken } from "./csrf-client.js";

// The module reads the global `fetch` at call time and caches in module scope,
// so every test drives both: a stubbed transport and an explicit clock.

// Advances freely; `getCsrfToken` only ever compares against this.
let clock;
/** Every request the client made, as `{ endpoint, init }`. */
let requests;
/** Queue of responses/errors to hand back, one per fetch. */
let responses;

/** A JSON response shaped like `/api/csrf`. */
function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	clock = 1_000_000;
	requests = [];
	responses = [];

	mock.method(globalThis, "fetch", async (endpoint, init) => {
		requests.push({ endpoint, init });
		const next = responses.shift();
		if (!next) {
			throw new Error("test made an unscheduled fetch");
		}
		if (next instanceof Error) throw next;
		return next;
	});

	clearCsrfToken();
});

afterEach(() => {
	clearCsrfToken();
	mock.restoreAll();
});

test("returns the token the endpoint issued", async () => {
	responses.push(jsonResponse({ csrfToken: "token-abc" }));

	const token = await getCsrfToken({ now: () => clock });

	assert.equal(token, "token-abc");
	assert.equal(requests.length, 1);
	assert.equal(requests[0].endpoint, "/api/csrf");
});

test("asks for the cookie alongside the token", async () => {
	// The whole scheme is double-submit: the server compares the header against
	// the `csrf_token` cookie. A request that skipped credentials would leave
	// the browser without the cookie and every later write would fail.
	responses.push(jsonResponse({ csrfToken: "token-abc" }));

	await getCsrfToken({ now: () => clock });

	assert.equal(requests[0].init.credentials, "same-origin");
	assert.equal(requests[0].init.cache, "no-store");
});

test("a second call reuses the cached token instead of refetching", async () => {
	responses.push(jsonResponse({ csrfToken: "token-abc" }));

	const first = await getCsrfToken({ now: () => clock });
	const second = await getCsrfToken({ now: () => clock });

	assert.equal(second, first);
	assert.equal(requests.length, 1);
});

test("concurrent callers share one request", async () => {
	// Three components mounting at once on a cold cache must not each mint a
	// token; a burst of `/api/csrf` hits is also what a rate limiter would see.
	responses.push(jsonResponse({ csrfToken: "token-abc" }));

	const tokens = await Promise.all([
		getCsrfToken({ now: () => clock }),
		getCsrfToken({ now: () => clock }),
		getCsrfToken({ now: () => clock }),
	]);

	assert.deepEqual(tokens, ["token-abc", "token-abc", "token-abc"]);
	assert.equal(requests.length, 1);
});

test("refetches once the cached token has aged out", async () => {
	responses.push(jsonResponse({ csrfToken: "first" }));
	assert.equal(await getCsrfToken({ now: () => clock }), "first");

	// The cookie this token must match is written with a one-hour maxAge, so a
	// token still being served at that point is a token with no cookie behind it.
	clock += 51 * 60 * 1000;
	responses.push(jsonResponse({ csrfToken: "second" }));

	assert.equal(await getCsrfToken({ now: () => clock }), "second");
	assert.equal(requests.length, 2);
});

test("keeps serving the cached token right up to its expiry", async () => {
	responses.push(jsonResponse({ csrfToken: "token-abc" }));
	await getCsrfToken({ now: () => clock });

	clock += 49 * 60 * 1000;
	assert.equal(await getCsrfToken({ now: () => clock }), "token-abc");
	assert.equal(requests.length, 1, "refetched well before the cache expired");
});

test("clearCsrfToken forces the next call back to the endpoint", async () => {
	responses.push(jsonResponse({ csrfToken: "first" }));
	await getCsrfToken({ now: () => clock });

	clearCsrfToken();
	responses.push(jsonResponse({ csrfToken: "second" }));

	assert.equal(await getCsrfToken({ now: () => clock }), "second");
	assert.equal(requests.length, 2);
});

test("a request already in flight does not resurrect a cleared token", async () => {
	// The clear happens while the fetch is outstanding. Caching its response
	// anyway would hand back the very token the caller discarded — and leave the
	// cache holding a token whose cookie may since have been rotated away.
	let release;
	responses.push(
		new Promise((resolve) => {
			release = () => resolve(jsonResponse({ csrfToken: "stale" }));
		}),
	);

	const pending = getCsrfToken({ now: () => clock });
	clearCsrfToken();
	release();
	await pending;

	responses.push(jsonResponse({ csrfToken: "fresh" }));
	assert.equal(await getCsrfToken({ now: () => clock }), "fresh");
});

test("reports the status when the endpoint fails", async () => {
	responses.push(jsonResponse({ error: "Unauthorized" }, 401));

	await assert.rejects(
		() => getCsrfToken({ now: () => clock }),
		/Could not fetch a CSRF token from \/api\/csrf: 401/,
	);
});

test("rejects a 200 that carries no token", async () => {
	// A proxy that answers 200 with an error page, or a route that changed shape,
	// would otherwise cache `undefined` and fail every later write with a
	// confusing mismatch instead of here.
	responses.push(jsonResponse({ error: "nope" }));

	await assert.rejects(
		() => getCsrfToken({ now: () => clock }),
		/did not return a csrfToken/,
	);
});

test("a failed fetch does not poison the cache", async () => {
	responses.push(new Error("network down"));
	await assert.rejects(() => getCsrfToken({ now: () => clock }));

	responses.push(jsonResponse({ csrfToken: "recovered" }));
	assert.equal(await getCsrfToken({ now: () => clock }), "recovered");
	assert.equal(requests.length, 2);
});

test("a failed shared request rejects every waiter, once", async () => {
	responses.push(jsonResponse({ error: "Unauthorized" }, 500));

	const results = await Promise.allSettled([
		getCsrfToken({ now: () => clock }),
		getCsrfToken({ now: () => clock }),
	]);

	assert.deepEqual(
		results.map((r) => r.status),
		["rejected", "rejected"],
	);
	// The rejection has to be handled on the shared promise's own branch too, or
	// it surfaces as an unhandled rejection rather than at the await site.
	assert.equal(requests.length, 1);
});

test("honours a custom endpoint", async () => {
	responses.push(jsonResponse({ csrfToken: "token-abc" }));

	await getCsrfToken({ endpoint: "/api/csrf-token", now: () => clock });

	assert.equal(requests[0].endpoint, "/api/csrf-token");
});
