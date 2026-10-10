import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";

// Resolve the @/ alias used by route files.
// `metrics/` is 4 levels below apps/web (metrics → api → app → src → web).
register(new URL("../../../../scripts/test-alias-loader.mjs", import.meta.url));

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `./route.js` is imported. This one matters
// more than usual: the route builds its logger at module scope
// (`createLogger("metrics")`), so a mock registered afterwards would not reach the
// bindings it already captured.
//
// Only `metrics.serialize` is replaced. The registry's own serialization is
// covered by packages/core/src/metrics.test.js; what is under test here is the
// response the route builds around it.

const core = await import("@usequark/quark-core/core");

/** What `metrics.serialize()` returns for the current test. */
let serialized;
/** When set, `metrics.serialize()` throws this error. */
let serializeError;
/** How many times the route serialized. */
let serializeCalls;
/** Messages the route's logger received at error level. */
let logErrors;

mock.module("@usequark/quark-core/core", {
	namedExports: {
		...core,
		createLogger: () => ({
			info() {},
			warn() {},
			debug() {},
			error: (message) => {
				logErrors.push(message);
			},
		}),
	},
});

mock.module("@usequark/quark-core/metrics", {
	namedExports: {
		metrics: {
			serialize: () => {
				serializeCalls++;
				if (serializeError) throw serializeError;
				return serialized;
			},
		},
	},
});

const EXPOSITION = [
	"# HELP http_requests_total Total HTTP requests",
	"# TYPE http_requests_total counter",
	'http_requests_total{method="GET",status="200"} 41',
	"",
].join("\n");

const { GET } = await import("./route.js");

beforeEach(() => {
	serialized = EXPOSITION;
	serializeError = null;
	serializeCalls = 0;
	logErrors = [];
});

afterEach(() => {
	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("GET /api/metrics serves the registry's exposition verbatim", async () => {
	const response = await GET();
	const body = await response.text();

	assert.strictEqual(response.status, 200);
	// Byte-for-byte: this is a machine-consumed scrape target. Re-encoding, trimming
	// the trailing newline or wrapping the output breaks Prometheus's parser, and
	// the failure shows up as a silently empty scrape rather than an error.
	assert.strictEqual(body, EXPOSITION);
	assert.strictEqual(serializeCalls, 1);
});

test("the Content-Type is the Prometheus text exposition format", async () => {
	const response = await GET();
	const contentType = response.headers.get("Content-Type");

	// `text/plain; version=0.0.4` is what tells a scraper how to parse the body. A
	// bare `text/plain` is still accepted by modern Prometheus but older agents and
	// some proxies key off the version parameter, and the JSON content type this
	// could regress to would make the scrape unparseable.
	assert.match(contentType, /^text\/plain\b/);
	assert.match(contentType, /version=0\.0\.4/);
	assert.match(contentType, /charset=utf-8/);
});

test("the response is not cacheable", async () => {
	const response = await GET();

	// A cached 200 would pin the exposition at scrape time. A Prometheus restart, a
	// counter reset or a dropped series then stays invisible until the cache expires,
	// and any intermediary is free to serve it for longer still.
	assert.strictEqual(response.headers.get("Cache-Control"), "no-store");
});

test("a serialization failure becomes a 500 that does not leak the cause", async () => {
	serializeError = new Error(
		"invalid metric name: http.requests{host=db-01.internal}",
	);

	const response = await GET();
	const raw = await response.text();

	assert.strictEqual(response.status, 500);
	// Internal hostnames and metric internals are reconnaissance. `handleError` is
	// not what runs here — the route hand-rolls this body — so it has to be asserted.
	assert.ok(
		!raw.includes("db-01.internal"),
		`500 body leaked the underlying failure: ${raw}`,
	);
	assert.deepStrictEqual(JSON.parse(raw), {
		error: "Failed to collect metrics",
	});
	// A silently-successful scrape looks like "the service is idle" to a human
	// reading the dashboard; the operator needs the log line.
	assert.deepStrictEqual(logErrors, ["Failed to serialize metrics"]);
});

test("a failed scrape is not reported as an empty but valid one", async () => {
	// An empty 200 is the one response Prometheus cannot distinguish from a process
	// that registered no metrics. Returning it here would make a broken exporter
	// look like a healthy idle one.
	serializeError = new Error("registry is closed");

	const response = await GET();

	assert.strictEqual(response.status, 500);
	// And it must not carry the exposition Content-Type, or a scraper pointed at a
	// failure parses an error page as metrics.
	assert.doesNotMatch(response.headers.get("Content-Type"), /version=0\.0\.4/);
});

test("an empty registry is a valid empty scrape, not a failure", async () => {
	serialized = "";

	const response = await GET();

	// Distinct from the 500 path above, and deliberately so: a fresh process that
	// has registered nothing yet must scrape as 200/empty. Turning this into a 500
	// would make a cold start look identical to a broken exporter.
	assert.strictEqual(response.status, 200);
	assert.strictEqual(await response.text(), "");
});

// NOTE (reported, not fixed): this route performs no authentication of any kind and
// its own docstring says "consider protecting this route" — the exposition carries
// internal route paths, latency histograms and error rates to anyone who asks. There
// is deliberately no test here asserting a status code for an unauthenticated
// request: that would lock in whichever answer the security review lands on. See the
// report.
