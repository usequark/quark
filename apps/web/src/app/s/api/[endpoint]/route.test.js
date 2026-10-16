import assert from "node:assert/strict";
import { register } from "node:module";
import { afterEach, beforeEach, test } from "node:test";

// Resolve the @/ alias used by route files.
// `[endpoint]` is 5 levels below apps/web (endpoint → api → s → app → src → web).
register(
	new URL("../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

const { DELETE, GET, OPTIONS, POST } = await import("./route.js");

const UPSTREAM = "https://stats.example.com";
const BODY = JSON.stringify({ type: "event", payload: {} });

let originalFetch;
let originalEnv;

function postRequest(endpoint, { headers = {}, body = BODY } = {}) {
	return new Request(`http://localhost/s/api/${endpoint}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body,
	});
}

function paramsFor(endpoint) {
	return { params: Promise.resolve({ endpoint }) };
}

beforeEach(() => {
	originalFetch = globalThis.fetch;
	originalEnv = { ...process.env };
	process.env.NEXT_PUBLIC_UMAMI_URL = UPSTREAM;
	process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID =
		"133660ed-e51c-4ed9-84aa-c86654460cae";
	delete process.env.UMAMI_UPSTREAM_URL;
	delete process.env.UMAMI_URL;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) delete process.env[key];
	}
	Object.assign(process.env, originalEnv);
});

test("rejects non-whitelisted endpoints instead of proxying them", async () => {
	const response = await POST(postRequest("websites"), paramsFor("websites"));

	assert.equal(response.status, 404);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("rejects non-POST methods", async () => {
	for (const handler of [GET, DELETE, OPTIONS]) {
		const response = await handler(
			new Request("http://localhost/s/api/send"),
			paramsFor("send"),
		);
		assert.equal(response.status, 405);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
	}
});

test("rejects non-JSON content types", async () => {
	const response = await POST(
		postRequest("send", {
			headers: { "Content-Type": "text/plain" },
			body: "hello",
		}),
		paramsFor("send"),
	);

	assert.equal(response.status, 415);
});

test("rejects oversized bodies", async () => {
	const response = await POST(
		postRequest("send", { body: "x".repeat(1_000_001) }),
		paramsFor("send"),
	);

	assert.equal(response.status, 413);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("rejects oversized chunked bodies without a Content-Length", async () => {
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode("x".repeat(600_000)));
			controller.enqueue(new TextEncoder().encode("x".repeat(600_000)));
			controller.close();
		},
	});
	const request = new Request("http://localhost/s/api/send", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: stream,
		duplex: "half",
	});

	const response = await POST(request, paramsFor("send"));

	assert.equal(response.status, 413);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("forwards analytics headers and strips credentials", async () => {
	let seen;
	globalThis.fetch = async (url, options) => {
		seen = { url, options };
		return new NextResponseShim(200, JSON.stringify({ ok: true }));
	};

	const response = await POST(
		postRequest("send", {
			headers: {
				Cookie: "session=abc",
				Authorization: "Bearer secret",
				"x-metrics-token": "internal",
				"User-Agent": "Mozilla/5.0",
				"Accept-Language": "en-NZ",
				"X-Forwarded-For": "203.0.113.7, 10.0.0.1",
				"x-umami-cache": "cache-token",
			},
		}),
		paramsFor("send"),
	);

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
	assert.equal(seen.url, `${UPSTREAM}/api/send`);
	assert.equal(
		seen.options.headers["X-Forwarded-For"],
		"203.0.113.7, 10.0.0.1",
	);
	assert.equal(seen.options.headers["X-Real-IP"], "203.0.113.7");
	assert.equal(seen.options.headers["User-Agent"], "Mozilla/5.0");
	assert.equal(seen.options.headers["Accept-Language"], "en-NZ");
	assert.equal(seen.options.headers["x-umami-cache"], "cache-token");
	assert.ok(!("Cookie" in seen.options.headers));
	assert.ok(!("cookie" in seen.options.headers));
	assert.ok(!("Authorization" in seen.options.headers));
	assert.ok(!("authorization" in seen.options.headers));
	assert.ok(!("x-metrics-token" in seen.options.headers));
});

test("prefers server-only upstream over the public URL", async () => {
	process.env.UMAMI_UPSTREAM_URL = "https://upstream.example.com";
	let seenUrl;
	globalThis.fetch = async (url) => {
		seenUrl = url;
		return new NextResponseShim(200, JSON.stringify({ ok: true }));
	};

	await POST(postRequest("collect"), paramsFor("collect"));

	assert.equal(seenUrl, "https://upstream.example.com/api/collect");
});

test("drops spoofable visitor IP headers when proxy headers are untrusted", async () => {
	process.env.TRUST_PROXY_HEADERS = "false";
	let seen;
	globalThis.fetch = async (url, options) => {
		seen = { url, options };
		return new NextResponseShim(200, JSON.stringify({ ok: true }));
	};

	const response = await POST(
		postRequest("send", {
			headers: {
				"X-Forwarded-For": "203.0.113.7",
				"X-Real-IP": "203.0.113.7",
			},
		}),
		paramsFor("send"),
	);

	assert.equal(response.status, 200);
	assert.equal(seen.options.headers["X-Forwarded-For"], "unknown");
	assert.equal(seen.options.headers["X-Real-IP"], "unknown");
});

test("strips upstream Set-Cookie from passthrough responses", async () => {
	globalThis.fetch = async () =>
		new NextResponseShim(200, JSON.stringify({ ok: true }), {
			"Content-Type": "application/json",
			"Set-Cookie": "tracking=1; Path=/",
		});

	const response = await POST(postRequest("record"), paramsFor("record"));

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
	assert.equal(response.headers.get("Set-Cookie"), null);
});

test("fails open with 202 when the upstream is down", async () => {
	globalThis.fetch = async () => {
		throw new Error("connection refused");
	};

	const response = await POST(postRequest("send"), paramsFor("send"));

	assert.equal(response.status, 202);
	assert.deepEqual(await response.json(), { ok: true, proxied: false });
});

test("fails open with 202 on upstream 5xx", async () => {
	globalThis.fetch = async () => new NextResponseShim(502, "bad gateway");

	const response = await POST(postRequest("send"), paramsFor("send"));

	assert.equal(response.status, 202);
	assert.deepEqual(await response.json(), { ok: true, proxied: false });
});

test("passes upstream 4xx through instead of masking client errors", async () => {
	globalThis.fetch = async () =>
		new NextResponseShim(400, JSON.stringify({ error: "bad payload" }), {
			"Content-Type": "application/json",
		});

	const response = await POST(postRequest("send"), paramsFor("send"));

	assert.equal(response.status, 400);
});

// Minimal upstream Response double: real Response works under node --test,
// but constructing it keeps this test independent of undici version quirks.
class NextResponseShim {
	constructor(status, body, headers = {}) {
		this.status = status;
		this.ok = status >= 200 && status < 300;
		this._body = body;
		this.headers = new Headers({
			"Content-Type": "application/json",
			...headers,
		});
	}

	async arrayBuffer() {
		return new TextEncoder().encode(this._body).buffer;
	}
}
