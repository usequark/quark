import assert from "node:assert/strict";
import { register } from "node:module";
import { afterEach, beforeEach, test } from "node:test";

// Resolve the @/ alias used by route files.
// `script.js` is 4 levels below apps/web (script.js → s → app → src → web).
register(new URL("../../../../scripts/test-alias-loader.mjs", import.meta.url));

const { DELETE, GET, POST } = await import("./route.js");

const UPSTREAM = "https://stats.example.com";
const TRACKER_JS = "/* fake-umami-tracker */window.umami={};";

let originalFetch;
let originalEnv;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	originalEnv = { ...process.env };
	process.env.NEXT_PUBLIC_UMAMI_URL = UPSTREAM;
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

function upstreamScriptResponse(body = TRACKER_JS, headers = {}) {
	return {
		ok: true,
		status: 200,
		headers: new Headers({
			"Content-Type": "application/javascript",
			...headers,
		}),
		async arrayBuffer() {
			return new TextEncoder().encode(body).buffer;
		},
	};
}

test("proxies the tracker without forwarding any client headers", async () => {
	let seen;
	globalThis.fetch = async (url, options) => {
		seen = { url, options };
		return upstreamScriptResponse();
	};

	const response = await GET(
		new Request("http://localhost/s/script.js", {
			headers: {
				Cookie: "session=abc",
				Authorization: "Bearer secret",
				"X-Forwarded-For": "203.0.113.7",
				"User-Agent": "Mozilla/5.0",
			},
		}),
	);

	assert.equal(response.status, 200);
	assert.equal(await response.text(), TRACKER_JS);
	assert.equal(seen.url, `${UPSTREAM}/script.js`);
	assert.deepEqual(seen.options?.headers ?? {}, {});
});

test("serves the tracker publicly cacheable and strips upstream cookies", async () => {
	globalThis.fetch = async () =>
		upstreamScriptResponse(TRACKER_JS, {
			"Set-Cookie": "tracking=1; Path=/",
			"Cache-Control": "private, no-store",
		});

	const response = await GET(new Request("http://localhost/s/script.js"));

	assert.equal(response.status, 200);
	assert.equal(
		response.headers.get("Cache-Control"),
		"public, max-age=3600, stale-while-revalidate=86400",
	);
	assert.equal(response.headers.get("Content-Type"), "application/javascript");
	assert.equal(response.headers.get("Set-Cookie"), null);
});

test("prefers the server-only upstream for the tracker destination", async () => {
	process.env.UMAMI_UPSTREAM_URL = "https://upstream.example.com";
	let seenUrl;
	globalThis.fetch = async (url) => {
		seenUrl = url;
		return upstreamScriptResponse();
	};

	await GET(new Request("http://localhost/s/script.js"));

	assert.equal(seenUrl, "https://upstream.example.com/script.js");
});

test("returns 404 when no upstream is configured", async () => {
	delete process.env.NEXT_PUBLIC_UMAMI_URL;
	let called = false;
	globalThis.fetch = async () => {
		called = true;
		return upstreamScriptResponse();
	};

	const response = await GET(new Request("http://localhost/s/script.js"));

	assert.equal(response.status, 404);
	assert.equal(called, false);
});

test("returns 502 without leaking when the upstream is down or errors", async () => {
	globalThis.fetch = async () => {
		throw new Error("connection refused");
	};

	const unreachable = await GET(new Request("http://localhost/s/script.js"));
	assert.equal(unreachable.status, 502);
	assert.equal(unreachable.headers.get("Cache-Control"), "no-store");

	globalThis.fetch = async () => ({
		ok: false,
		status: 500,
		headers: new Headers(),
	});

	const errored = await GET(new Request("http://localhost/s/script.js"));
	assert.equal(errored.status, 502);
});

test("rejects non-GET methods", async () => {
	const response = await POST(new Request("http://localhost/s/script.js"), {});

	assert.equal(response.status, 405);

	const deleted = await DELETE(new Request("http://localhost/s/script.js"));
	assert.equal(deleted.status, 405);
});
