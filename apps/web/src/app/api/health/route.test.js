import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

// ── Mocks ────────────────────────────────────────────────────────────────────

let originalPrisma;
let originalFetch;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	originalFetch = globalThis.fetch;
	delete globalThis.__prisma;

	globalThis.__prisma = {
		$user: {
			findFirst: mock.fn(async () => null),
		},
	};

	globalThis.fetch = mock.fn(async () => new Response("ok", { status: 200 }));
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

	mock.restoreAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
	test("returns 200 with expected health shape when checks pass", async () => {
		const core = await import("@usequark/quark-core");

		mock.module("@usequark/quark-db", {
			namedExports: {
				pingDatabase: async () => ({ status: "ok", latencyMs: 1 }),
			},
		});

		mock.module("@usequark/quark-core", {
			namedExports: {
				...core,
				createLogger: () => ({
					info() {},
					error() {},
					warn() {},
					debug() {},
				}),
				pingRedis: async () => ({ status: "ok", latencyMs: 2 }),
				createStorage: () => ({
					provider: "local",
					put: async () => {},
					delete: async () => {},
				}),
				getRegisteredQueues: () => new Map(),
			},
		});

		const { GET } = await import("./route.js");
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
});
