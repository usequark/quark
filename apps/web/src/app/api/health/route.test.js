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
		queues: () => new Map(),
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
// imports has to be substitutable here. `checkStorage` / `checkQueues` are
// overridden rather than `createStorage` / `getRegisteredQueues`: the real
// implementations reach for the adapter and the queue registry through
// health.js's *own* imports — which a mock of this module does not intercept.
// Overriding the probe functions themselves is what keeps this test about the
// route's wiring; their internals are covered by health.test.js.
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
		checkQueues: async () => {
			probesRan.add("queues");
			return core.checkQueues(() => probes.queues());
		},
	},
});

// The route reaches the registry directly rather than through a probe
// parameter, so the registry itself is what has to be substitutable here.
mock.module("@usequark/quark-core/queue", {
	namedExports: {
		getRegisteredQueues: () => probes.queues(),
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
		probes.queues = () =>
			new Map([
				[
					"emails",
					{
						getWaitingCount: () => tracked(60),
						getActiveCount: async () => 0,
						getFailedCount: async () => 0,
					},
				],
			]);

		await GET();

		// One probe per dependency: database, redis, storage, queues. Sequentially,
		// 4 x 60ms would never put more than 1 in flight — and 240ms of serial
		// probes is a meaningful fraction of the 5s budget.
		assert.strictEqual(
			peakInFlight,
			4,
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

	test("omits the queues key when no queues are registered in this process", async () => {
		const body = await (await GET()).json();

		assert.ok(!("queues" in body.checks));
	});

	test("reports a failing queue as degraded", async () => {
		probes.queues = () =>
			new Map([
				[
					"emails",
					{
						getWaitingCount: async () => {
							throw new Error("queue gone");
						},
						getActiveCount: async () => 0,
						getFailedCount: async () => 0,
					},
				],
			]);

		const response = await GET();
		const body = await response.json();

		assert.strictEqual(response.status, 200);
		assert.strictEqual(body.status, "degraded");
		assert.strictEqual(body.checks.queues.emails.status, "error");
	});

	test("reports queue depths when queues are registered", async () => {
		probes.queues = () =>
			new Map([
				[
					"emails",
					{
						getWaitingCount: async () => 3,
						getActiveCount: async () => 1,
						getFailedCount: async () => 0,
					},
				],
			]);

		const body = await (await GET()).json();

		assert.strictEqual(body.status, "ok");
		assert.deepStrictEqual(body.checks.queues.emails, {
			status: "ok",
			waiting: 3,
			active: 1,
			failed: 0,
		});
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
		// The route's remaining job is wiring: which probes run, and that all four
		// reach the aggregate. The concurrency and deadline behaviour those probes
		// need now lives in core and is covered by health.test.js.
		probes.queues = () =>
			new Map([
				[
					"emails",
					{
						getWaitingCount: async () => {
							probesRan.add("queues:depth");
							return 0;
						},
						getActiveCount: async () => 0,
						getFailedCount: async () => 0,
					},
				],
			]);

		const body = await (await GET()).json();

		assert.strictEqual(body.status, "ok");
		for (const probe of ["database", "redis", "storage", "queues"]) {
			assert.ok(probesRan.has(probe), `route never ran the ${probe} probe`);
		}
		// The queue probe is reached through getRegisteredQueues, so the registry
		// itself has to be consulted.
		assert.ok(probesRan.has("queues:depth"), "queue depths were never read");
	});

	test("sets Cache-Control: no-store so a probe result is never cached", async () => {
		const response = await GET();

		assert.strictEqual(response.headers.get("Cache-Control"), "no-store");
	});
});
