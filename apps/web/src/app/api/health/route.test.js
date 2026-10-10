import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Registered at module scope, before `route.js` is imported: the route binds its
// probe functions at import time, and importing it first would pull in the real
// `@usequark/quark-db` (which needs a generated Prisma client) before the mock
// is in place.
//
// Per-test behaviour is swapped behind these mocks rather than re-mocked.
// `import("./route.js")` is cached after the first call, so a second
// `mock.module` would not reach the bindings the route already holds.

let originalPrisma;
let originalFetch;
let originalNodeEnv;

/** Probe behaviour for the current test. Mutated by each test. */
let probes;

/**
 * Names of the probe functions the route actually invoked.
 *
 * `probes` holds the *fixtures* each probe would use; this records that the
 * probe ran at all. They are not the same thing — a probe whose fixture is never
 * consulted is still a probe that ran, and only this set proves the route wired
 * it in. The `pingRedis` / `pingDatabase` fixtures below record their own name,
 * so every probe is observable here.
 */
let probesRan;

/** Resets every probe to a passing baseline. */
function resetProbes() {
	probes = {
		database: async () => ({ status: "ok", latencyMs: 1 }),
		redis: async () => ({ status: "ok", latencyMs: 2 }),
		storage: () => ({
			provider: "local",
			put: async () => {},
			delete: async () => {},
		}),
	};
}

resetProbes();

probesRan = new Set();

const core = await import("@usequark/quark-core/health");
const coreModule = await import("@usequark/quark-core/core");

mock.module("@usequark/quark-db", {
	namedExports: {
		pingDatabase: () => {
			probesRan.add("database");
			return probes.database();
		},
	},
});

// The route wires these in as raw probe functions, so each module it actually
// imports has to be substitutable here. `checkStorage` is overridden rather than
// `createStorage`: the real implementation reaches for the adapter through
// health.js's *own* imports, which a mock of this module does not intercept.
// Overriding the probe function itself is what keeps this test about the route's
// wiring; the internals are covered by health.test.js.
mock.module("@usequark/quark-core/core", {
	namedExports: {
		...coreModule,
		createLogger: () => ({
			info() {},
			error() {},
			warn() {},
			debug() {},
		}),
	},
});

mock.module("@usequark/quark-core/redis", {
	namedExports: {
		pingRedis: () => {
			probesRan.add("redis");
			return probes.redis();
		},
	},
});

mock.module("@usequark/quark-core/health", {
	namedExports: {
		...core,
		createLogger: () => ({
			info() {},
			error() {},
			warn() {},
			debug() {},
		}),
		pingRedis: () => {
			probesRan.add("redis");
			return probes.redis();
		},
		checkStorage: async () => {
			probesRan.add("storage");
			const storage = probes.storage();
			await storage.put(".health-check-sentinel", Buffer.from("ok"), {
				contentType: "text/plain",
			});
			await storage.delete(".health-check-sentinel");
			return { status: "ok", provider: storage.provider };
		},
	},
});

const { GET } = await import("./route.js");

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	originalFetch = globalThis.fetch;
	originalNodeEnv = process.env.NODE_ENV;
	delete globalThis.__prisma;

	globalThis.__prisma = {
		$user: {
			findFirst: mock.fn(async () => null),
		},
	};

	globalThis.fetch = mock.fn(async () => new Response("ok", { status: 200 }));

	resetProbes();
	probesRan.clear();
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}

	if (originalFetch !== undefined) {
		globalThis.fetch = originalFetch;
	} else {
		delete globalThis.fetch;
	}

	if (originalNodeEnv === undefined) {
		delete process.env.NODE_ENV;
	} else {
		process.env.NODE_ENV = originalNodeEnv;
	}
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
	test("returns 200 with expected health shape when checks pass", async () => {
		const response = await GET();
		const body = await response.json();

		assert.strictEqual(response.status, 200);
		assert.strictEqual(body.status, "ok");
		assert.ok(typeof body.timestamp === "string");
		assert.ok(body.checks);
		assert.strictEqual(body.checks.database.status, "ok");
		assert.strictEqual(body.checks.redis.status, "ok");
		assert.strictEqual(body.checks.storage.status, "ok");
		assert.strictEqual(body.checks.storage.provider, "local");
	});

	test("returns 200 when a dependency is down, reporting degraded in the body", async () => {
		probes.redis = async () => ({
			status: "error",
			message: "Redis unreachable at cache:6379",
		});

		const response = await GET();
		const body = await response.json();

		// A non-200 here makes the orchestrator restart the container, which drops
		// every warm connection and produces a fresh connection storm on the
		// dependency that was already struggling.
		assert.strictEqual(response.status, 200);
		assert.strictEqual(body.status, "degraded");
		assert.strictEqual(body.checks.redis.status, "error");
		assert.strictEqual(body.checks.database.status, "ok");
	});

	test("returns 200 when a dependency probe throws", async () => {
		probes.database = async () => {
			throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
		};

		const response = await GET();
		const body = await response.json();

		assert.strictEqual(response.status, 200);
		assert.strictEqual(body.status, "degraded");
		assert.strictEqual(body.checks.database.status, "error");
	});

	test("probes dependencies concurrently, not one after another", async () => {
		let inFlight = 0;
		let peakInFlight = 0;

		/** A probe that records how many probes overlap it. */
		const tracked = async (latencyMs) => {
			inFlight++;
			peakInFlight = Math.max(peakInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, latencyMs));
			inFlight--;
			return { status: "ok", latencyMs };
		};

		probes.database = () => tracked(60);
		probes.redis = () => tracked(60);
		probes.storage = () => ({
			provider: "local",
			put: () => tracked(60),
			delete: async () => {},
		});

		await GET();

		// One probe per dependency: database, redis, storage. Sequentially, 3 x 60ms
		// would never put more than 1 in flight — and 180ms of serial probes is a
		// meaningful fraction of the 5s budget.
		assert.strictEqual(
			peakInFlight,
			3,
			"probes did not overlap — they are running sequentially",
		);
	});

	test("answers within the deadline when a probe hangs", async () => {
		// Never settles. Pre-fix this hung the request until the route's outer
		// 5s timer fired, which returned 500 and triggered a container restart.
		probes.database = () => new Promise(() => {});

		const startedAt = Date.now();
		const response = await GET();
		const elapsed = Date.now() - startedAt;
		const body = await response.json();

		assert.strictEqual(response.status, 200);
		assert.strictEqual(body.checks.database.status, "error");
		assert.match(body.checks.database.message, /timed out/);
		// Probe deadline is 3s. Generous ceiling: the point is that the request
		// returns a body instead of hanging on a promise that never settles.
		assert.ok(elapsed < 4500, `probe deadline not enforced (${elapsed}ms)`);
	});

	test("never reports queues, and so never loads the queue module", async () => {
		const body = await (await GET()).json();

		// `getRegisteredQueues()` reads a per-process Map of queues created in
		// *this* process. The web service creates none — the worker owns every
		// long-lived queue — so this probe returned null on every request while
		// loading all of BullMQ into a route polled by the platform healthcheck
		// and by every page view. Queue depth is published by the worker as
		// `job_queue_depth`; see `updateQueueDepths()` in apps/worker/src/index.js.
		assert.ok(!("queues" in body.checks));
		assert.deepStrictEqual(Object.keys(body.checks).sort(), [
			"database",
			"redis",
			"storage",
		]);
	});

	test("never returns a credential from a probe message in production", async () => {
		process.env.NODE_ENV = "production";

		// The pre-fix pingRedis returned the raw REDIS_URL, password and all.
		probes.redis = async () => ({
			status: "error",
			message: "connect ECONNREFUSED redis://default:hunter2@cache:6379",
		});
		probes.storage = () => ({
			provider: "s3",
			put: async () => {
				throw new Error(
					"AccessDenied: https://user:hunter2@bucket.s3.amazonaws.com/key",
				);
			},
			delete: async () => {},
		});

		const response = await GET();
		const raw = await response.text();

		assert.strictEqual(response.status, 200);
		assert.ok(
			!raw.includes("hunter2"),
			`health response leaked a credential: ${raw}`,
		);
	});

	test("echoes the real error message outside production", async () => {
		process.env.NODE_ENV = "development";

		probes.redis = async () => {
			throw new Error("Redis unreachable at cache.internal:6379");
		};

		const body = await (await GET()).json();

		assert.strictEqual(
			body.checks.redis.message,
			"Redis unreachable at cache.internal:6379",
		);
	});

	test("probes every dependency the route wires in", async () => {
		// The route's remaining job is wiring: which probes run, and that all three
		// reach the aggregate. The concurrency and deadline behaviour those probes
		// need now lives in core and is covered by health.test.js.
		const body = await (await GET()).json();

		assert.strictEqual(body.status, "ok");
		for (const probe of ["database", "redis", "storage"]) {
			assert.ok(probesRan.has(probe), `route never ran the ${probe} probe`);
		}
	});

	test("sets Cache-Control: no-store so a probe result is never cached", async () => {
		const response = await GET();

		assert.strictEqual(response.headers.get("Cache-Control"), "no-store");
	});
});
