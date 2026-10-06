import assert from "node:assert";
import { afterEach, beforeEach, test } from "node:test";

import {
	checkQueues,
	checkStorage,
	isFailing,
	runHealthChecks,
} from "./health.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A probe that records how many probes overlap it.
 *
 * `counter` is shared across every probe in one test — a per-probe counter could
 * never observe more than one in flight, which would make the concurrency
 * assertion vacuously pass.
 */
function counter() {
	return { inFlight: 0, peak: 0 };
}

/** A probe that settles after `latencyMs`, sharing a single in-flight counter. */
function tracked(c, status, latencyMs = 0) {
	return async () => {
		c.inFlight++;
		c.peak = Math.max(c.peak, c.inFlight);
		await new Promise((resolve) => setTimeout(resolve, latencyMs));
		c.inFlight--;
		return { status };
	};
}

let originalNodeEnv;
let originalDir;

beforeEach(() => {
	originalNodeEnv = process.env.NODE_ENV;
	originalDir = process.env.STORAGE_LOCAL_DIR;
});

afterEach(() => {
	if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = originalNodeEnv;

	if (originalDir === undefined) delete process.env.STORAGE_LOCAL_DIR;
	else process.env.STORAGE_LOCAL_DIR = originalDir;
});

// ── runHealthChecks ──────────────────────────────────────────────────────────

test("runHealthChecks returns ok when every probe passes", async () => {
	const report = await runHealthChecks({
		probes: {
			database: async () => ({ status: "ok", latencyMs: 1 }),
			redis: async () => ({ status: "ok", latencyMs: 2 }),
		},
	});

	assert.strictEqual(report.status, "ok");
	assert.strictEqual(report.checks.database.status, "ok");
	assert.strictEqual(report.checks.redis.status, "ok");
	assert.ok(typeof report.timestamp === "string");
	assert.ok(Number.isFinite(report.durationMs));
});

test("runHealthChecks probes concurrently, not one after another", async () => {
	// The defect this exists to prevent. Sequentially, three probes at 80ms would
	// never put more than one in flight, and their 240ms total is a real fraction
	// of the budget.
	const shared = counter();
	const startedAt = Date.now();

	await runHealthChecks({
		probes: {
			a: tracked(shared, "ok", 80),
			b: tracked(shared, "ok", 80),
			c: tracked(shared, "ok", 80),
		},
	});
	const elapsed = Date.now() - startedAt;

	assert.strictEqual(
		shared.peak,
		3,
		"probes did not overlap — they are running sequentially",
	);
	// Overlap and duration together: 3x80ms serialised would also show peak 1, so
	// the wall-clock bound is the independent check that the aggregate is the max
	// of the probes rather than their sum.
	assert.ok(
		elapsed < 200,
		`probes appear serialised (${elapsed}ms for 3x80ms)`,
	);
});

test("runHealthChecks aggregates inside the overall deadline when probes hang", async () => {
	// Never settles. Without a per-probe deadline the aggregate would hang until
	// the caller gave up.
	const startedAt = Date.now();
	const report = await runHealthChecks({
		timeout: 120,
		probeTimeout: 120,
		probes: {
			database: () => new Promise(() => {}),
			redis: async () => ({ status: "ok" }),
		},
	});
	const elapsed = Date.now() - startedAt;

	assert.strictEqual(report.status, "degraded");
	assert.strictEqual(report.checks.database.status, "error");
	assert.match(report.checks.database.message, /timed out/);
	assert.ok(elapsed < 600, `aggregate outlived its budget (${elapsed}ms)`);
});

test("runHealthChecks clamps the probe deadline to the overall budget", async () => {
	// A probeTimeout above the overall budget must not let a probe outlive the
	// request: the clamp is what makes "the aggregate always completes inside
	// the budget" true regardless of how the caller configured it.
	const startedAt = Date.now();
	await runHealthChecks({
		timeout: 100,
		probeTimeout: 60_000,
		probes: { database: () => new Promise(() => {}) },
	});
	const elapsed = Date.now() - startedAt;

	assert.ok(elapsed < 600, `probe outlived the overall budget (${elapsed}ms)`);
});

test("runHealthChecks does not reject when a probe throws", async () => {
	const report = await runHealthChecks({
		probes: {
			database: async () => {
				throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
			},
			redis: async () => ({ status: "ok" }),
		},
	});

	assert.strictEqual(report.status, "degraded");
	assert.strictEqual(report.checks.database.status, "error");
	assert.strictEqual(report.checks.redis.status, "ok");
});

test("runHealthChecks omits a key when a probe opts out", async () => {
	// A probe returning null is absent, not passing. Reporting a false pass for a
	// queue that was never registered would be worse than silence.
	const report = await runHealthChecks({
		probes: {
			database: async () => ({ status: "ok" }),
			queues: async () => null,
		},
	});

	assert.ok(!("queues" in report.checks));
	assert.strictEqual(report.status, "ok");
});

// ── Credential redaction ────────────────────────────────────────────────────

test("runHealthChecks redacts credentials from a probe that REJECTS", async () => {
	process.env.NODE_ENV = "development";

	const report = await runHealthChecks({
		probes: {
			redis: async () => {
				throw new Error(
					"connect ECONNREFUSED redis://default:hunter2@cache.internal:6379",
				);
			},
		},
	});

	assert.ok(
		!JSON.stringify(report).includes("hunter2"),
		`report leaked a credential: ${JSON.stringify(report)}`,
	);
});

test("runHealthChecks redacts credentials from a probe that RESOLVES with an error", async () => {
	// The shape that bit us before: `pingRedis` reported failure by resolving
	// with { status: "error", message }, not by rejecting. A normaliser that
	// handled only rejections would pass this straight through.
	process.env.NODE_ENV = "development";

	const report = await runHealthChecks({
		probes: {
			redis: async () => ({
				status: "error",
				message: "unreachable at redis://default:hunter2@cache.internal:6379",
			}),
		},
	});

	assert.ok(
		!JSON.stringify(report).includes("hunter2"),
		`report leaked a credential: ${JSON.stringify(report)}`,
	);
});

test("runHealthChecks returns a generic message in production", async () => {
	process.env.NODE_ENV = "production";

	const report = await runHealthChecks({
		probes: {
			database: async () => {
				throw new Error("password authentication failed for user admin");
			},
		},
	});

	assert.strictEqual(report.checks.database.message, "Database unavailable");
});

test("runHealthChecks keeps the real message outside production", async () => {
	process.env.NODE_ENV = "development";

	const report = await runHealthChecks({
		probes: {
			redis: async () => {
				throw new Error("Redis unreachable at cache.internal:6379");
			},
		},
	});

	assert.strictEqual(
		report.checks.redis.message,
		"Redis unreachable at cache.internal:6379",
	);
});

// ── isFailing ───────────────────────────────────────────────────────────────

test("isFailing reads a flat probe result", () => {
	assert.strictEqual(isFailing({ status: "ok" }), false);
	assert.strictEqual(isFailing({ status: "error" }), true);
});

test("isFailing reads the nested queue map", () => {
	// The verdict lives on each queue, not on the map itself.
	assert.strictEqual(
		isFailing({ emails: { status: "ok" }, reports: { status: "ok" } }),
		false,
	);
	assert.strictEqual(
		isFailing({ emails: { status: "ok" }, reports: { status: "error" } }),
		true,
	);
});

test("isFailing treats a missing check as not failing", () => {
	assert.strictEqual(isFailing(null), false);
	assert.strictEqual(isFailing(undefined), false);
});

// ── checkStorage ────────────────────────────────────────────────────────────

test("checkStorage writes and removes a sentinel object", async () => {
	const { mkdtemp, rm, readdir } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");

	const dir = await mkdtemp(join(tmpdir(), "health-storage-"));
	const previousProvider = process.env.STORAGE_PROVIDER;
	process.env.STORAGE_LOCAL_DIR = dir;
	process.env.STORAGE_PROVIDER = "local";

	try {
		const result = await checkStorage();

		assert.strictEqual(result.status, "ok");
		assert.strictEqual(result.provider, "local");
		// The sentinel must not be left behind, or every probe leaks a file.
		assert.deepStrictEqual(await readdir(dir), []);
	} finally {
		if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
		else process.env.STORAGE_PROVIDER = previousProvider;
		await rm(dir, { recursive: true, force: true });
	}
});

test("checkStorage fails when the directory is not writable", async () => {
	// The defect the brief flags: a `stat`-based check passes here, because the
	// directory exists. It is the only failure this probe exists to catch, so the
	// sentinel round-trip is what distinguishes the two.
	if (process.getuid?.() === 0) return; // root ignores the mode bits

	const { mkdtemp, chmod, rm } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");

	const dir = await mkdtemp(join(tmpdir(), "health-readonly-"));
	const previousProvider = process.env.STORAGE_PROVIDER;
	process.env.STORAGE_LOCAL_DIR = dir;
	process.env.STORAGE_PROVIDER = "local";

	try {
		await chmod(dir, 0o500); // read + execute, no write
		await assert.rejects(() => checkStorage());
	} finally {
		await chmod(dir, 0o700).catch(() => {});
		if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
		else process.env.STORAGE_PROVIDER = previousProvider;
		await rm(dir, { recursive: true, force: true });
	}
});

// ── checkQueues ─────────────────────────────────────────────────────────────

function fakeQueue({
	waiting = 0,
	active = 0,
	failed = 0,
	throwOn = null,
} = {}) {
	const count = (kind) => {
		if (throwOn === kind) throw new Error(`queue gone (${kind})`);
		return { waiting, active, failed }[kind];
	};
	return {
		getWaitingCount: async () => count("waiting"),
		getActiveCount: async () => count("active"),
		getFailedCount: async () => count("failed"),
	};
}

test("checkQueues reports depths for registered queues", async () => {
	const result = await checkQueues(
		() => new Map([["emails", fakeQueue({ waiting: 3, active: 1 })]]),
	);

	assert.deepStrictEqual(result.emails, {
		status: "ok",
		waiting: 3,
		active: 1,
		failed: 0,
	});
});

test("checkQueues returns null when no queues are registered", async () => {
	// The web app registers none, so this must be absent from the report rather
	// than reported as a passing check.
	assert.strictEqual(await checkQueues(() => new Map()), null);
});

test("checkQueues marks a failing queue without failing its siblings", async () => {
	const result = await checkQueues(
		() =>
			new Map([
				["emails", fakeQueue({ waiting: 1 })],
				["reports", fakeQueue({ throwOn: "waiting" })],
			]),
	);

	assert.strictEqual(result.emails.status, "ok");
	assert.strictEqual(result.reports.status, "error");
	assert.match(result.reports.message, /queue gone/);
});

test("checkQueues redacts a credential from a queue failure", async () => {
	process.env.NODE_ENV = "development";

	const result = await checkQueues(
		() =>
			new Map([
				[
					"emails",
					{
						getWaitingCount: async () => {
							throw new Error(
								"NOAUTH redis://default:hunter2@cache.internal:6379",
							);
						},
						getActiveCount: async () => 0,
						getFailedCount: async () => 0,
					},
				],
			]),
	);

	assert.ok(
		!JSON.stringify(result).includes("hunter2"),
		`queue failure leaked a credential: ${JSON.stringify(result)}`,
	);
});
