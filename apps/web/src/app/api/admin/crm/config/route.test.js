import assert from "node:assert";
import { register } from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { UnauthorizedError } from "@techstream/quark-core/errors";

// Resolve @/ alias used by route files
register(
	new URL("../../../../../../scripts/test-alias-loader.mjs", import.meta.url),
);

// ── Auth mock with swappable implementations ─────────────────────────────────

const authMiddlewareUrl = pathToFileURL(
	new URL("../../../../../lib/auth-middleware.js", import.meta.url).pathname,
).href;

let requireRoleImpl = async () => ({
	user: { id: "user-1", role: "admin", email: "admin@example.com" },
});

mock.module(authMiddlewareUrl, {
	namedExports: {
		requireAuth: (...args) => requireRoleImpl(...args),
		requireRole: (...args) => requireRoleImpl(...args),
	},
});

// ── Prisma mock helpers ─────────────────────────────────────────────────────

const DEFAULT_VALUE = {
	entityLabel: "Deal",
	entityPluralLabel: "Deals",
	containerLabel: "Company",
	containerPluralLabel: "Companies",
	actorLabel: "Contact",
	actorPluralLabel: "Contacts",
	pipelineStages: [
		{
			key: "LEAD",
			label: "Lead",
			color: "default",
			probability: 10,
			next: ["QUALIFIED"],
		},
	],
	currency: "USD",
	locale: "en-US",
	defaultPageSize: 25,
	fields: {
		entity: [{ key: "title", type: "text", required: true }],
		actor: [{ key: "firstName", type: "text", required: true }],
		container: [{ key: "name", type: "text", required: true }],
	},
};

let originalPrisma;
let appConfigStore;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	delete globalThis.__prisma;
	appConfigStore = null;
	requireRoleImpl = async () => ({
		user: { id: "user-1", role: "admin", email: "admin@example.com" },
	});
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	mock.restoreAll();
});

function setPrismaMock() {
	const prismaMock = {
		appConfig: {
			findUnique: mock.fn(async ({ where }) => {
				if (where.key !== "crm") return null;
				if (!appConfigStore) return null;
				return { id: "cfg-1", key: "crm", value: appConfigStore };
			}),
			upsert: mock.fn(async ({ create, update }) => {
				appConfigStore = update?.value ?? create?.value;
				return { id: "cfg-1", key: "crm", value: appConfigStore };
			}),
		},
	};
	globalThis.__prisma = prismaMock;
	return prismaMock;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test("GET /api/admin/crm/config returns defaults when no config exists", async () => {
	setPrismaMock();

	const { GET } = await import("./route.js");
	const response = await GET(
		new Request("http://localhost/api/admin/crm/config"),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.ok(body.data);
	assert.strictEqual(body.data.entityLabel, "Deal");
	assert.strictEqual(body.data.currency, "USD");
	assert.ok(Array.isArray(body.data.pipelineStages));
});

test("GET /api/admin/crm/config returns stored config", async () => {
	appConfigStore = {
		...DEFAULT_VALUE,
		entityLabel: "Ticket",
		entityPluralLabel: "Tickets",
		currency: "EUR",
	};
	setPrismaMock();

	const { GET } = await import("./route.js");
	const response = await GET(
		new Request("http://localhost/api/admin/crm/config"),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.data.entityLabel, "Ticket");
	assert.strictEqual(body.data.currency, "EUR");
});

test("PUT /api/admin/crm/config updates config", async () => {
	appConfigStore = { ...DEFAULT_VALUE };
	const prismaMock = setPrismaMock();

	const { PUT } = await import("./route.js");
	const response = await PUT(
		new Request("http://localhost/api/admin/crm/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entityLabel: "Opportunity",
				currency: "GBP",
			}),
		}),
	);
	const body = await response.json();

	assert.strictEqual(response.status, 200);
	assert.strictEqual(body.data.entityLabel, "Opportunity");
	assert.strictEqual(body.data.currency, "GBP");
	assert.ok(prismaMock.appConfig.upsert.mock.callCount() >= 1);
});

test("PUT /api/admin/crm/config validates with Zod", async () => {
	setPrismaMock();

	const { PUT } = await import("./route.js");
	const response = await PUT(
		new Request("http://localhost/api/admin/crm/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				defaultPageSize: -5,
			}),
		}),
	);
	const body = await response.json();

	assert.ok(response.status >= 400);
	assert.ok(body.message || body.code || body.name);
});

test("GET /api/admin/crm/config returns 401 when unauthenticated", async () => {
	requireRoleImpl = async () => {
		throw new UnauthorizedError(
			"You must be logged in to access this resource",
		);
	};
	setPrismaMock();

	const { GET } = await import("./route.js");
	const response = await GET(
		new Request("http://localhost/api/admin/crm/config"),
	);

	assert.strictEqual(response.status, 401);
});
