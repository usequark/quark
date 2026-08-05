import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { DEFAULT_CRM_CONFIG, getCrmConfig, updateCrmConfig } from "./config.js";
import { formatCurrency } from "./format.js";

describe("DEFAULT_CRM_CONFIG", () => {
	const { pipelineStages } = DEFAULT_CRM_CONFIG;
	const stageKeys = pipelineStages.map((s) => s.key);

	it("exports a non-empty pipelineStages array", () => {
		assert.ok(Array.isArray(pipelineStages));
		assert.ok(pipelineStages.length > 0);
	});

	it("has unique stage keys", () => {
		assert.strictEqual(new Set(stageKeys).size, stageKeys.length);
	});

	it("has a defaultPageSize", () => {
		assert.equal(typeof DEFAULT_CRM_CONFIG.defaultPageSize, "number");
		assert.ok(DEFAULT_CRM_CONFIG.defaultPageSize > 0);
	});

	it("exports entity labels", () => {
		assert.equal(typeof DEFAULT_CRM_CONFIG.entityLabel, "string");
		assert.equal(typeof DEFAULT_CRM_CONFIG.entityPluralLabel, "string");
		assert.equal(typeof DEFAULT_CRM_CONFIG.containerLabel, "string");
		assert.equal(typeof DEFAULT_CRM_CONFIG.containerPluralLabel, "string");
		assert.equal(typeof DEFAULT_CRM_CONFIG.actorLabel, "string");
		assert.equal(typeof DEFAULT_CRM_CONFIG.actorPluralLabel, "string");
	});

	it("does not export a domain field", () => {
		assert.equal(DEFAULT_CRM_CONFIG.domain, undefined);
	});

	it("exports currency and locale", () => {
		assert.equal(typeof DEFAULT_CRM_CONFIG.currency, "string");
		assert.equal(typeof DEFAULT_CRM_CONFIG.locale, "string");
	});

	it("exports field definitions for entity, actor, and container", () => {
		assert.ok(Array.isArray(DEFAULT_CRM_CONFIG.fields.entity));
		assert.ok(Array.isArray(DEFAULT_CRM_CONFIG.fields.actor));
		assert.ok(Array.isArray(DEFAULT_CRM_CONFIG.fields.container));
		assert.ok(DEFAULT_CRM_CONFIG.fields.entity.length > 0);
		assert.ok(DEFAULT_CRM_CONFIG.fields.actor.length > 0);
		assert.ok(DEFAULT_CRM_CONFIG.fields.container.length > 0);
	});

	it("entity fields have key and type (labels optional)", () => {
		for (const field of DEFAULT_CRM_CONFIG.fields.entity) {
			assert.ok(field.key, "missing key");
			assert.ok(field.type, "missing type");
		}
	});

	it("actor fields have key and type (labels optional)", () => {
		for (const field of DEFAULT_CRM_CONFIG.fields.actor) {
			assert.ok(field.key, "missing key");
			assert.ok(field.type, "missing type");
		}
	});

	it("container fields have key and type (labels optional)", () => {
		for (const field of DEFAULT_CRM_CONFIG.fields.container) {
			assert.ok(field.key, "missing key");
			assert.ok(field.type, "missing type");
		}
	});

	describe("each pipeline stage", () => {
		for (const stage of pipelineStages) {
			it(`"${stage.key}" has all required fields`, () => {
				assert.ok(stage.key, "missing key");
				assert.ok(stage.label, "missing label");
				assert.ok(stage.color, "missing color");
				assert.equal(typeof stage.probability, "number");
				assert.ok(Array.isArray(stage.next));
			});

			it(`"${stage.key}" has a probability between 0 and 100`, () => {
				assert.ok(stage.probability >= 0);
				assert.ok(stage.probability <= 100);
			});

			it(`"${stage.key}" only references known stage keys in "next"`, () => {
				for (const nextKey of stage.next) {
					assert.ok(
						stageKeys.includes(nextKey),
						`"${stage.key}" references unknown stage "${nextKey}"`,
					);
				}
			});
		}
	});

	it("has CLOSED_WON and CLOSED_LOST as terminal stages (empty next)", () => {
		const closedWon = pipelineStages.find((s) => s.key === "CLOSED_WON");
		const closedLost = pipelineStages.find((s) => s.key === "CLOSED_LOST");
		assert.ok(closedWon, "CLOSED_WON stage missing");
		assert.ok(closedLost, "CLOSED_LOST stage missing");
		assert.deepStrictEqual(closedWon.next, []);
		assert.deepStrictEqual(closedLost.next, []);
	});

	it("has LEAD as the first/entry stage by convention", () => {
		assert.equal(pipelineStages[0].key, "LEAD");
		assert.ok(pipelineStages[0].next.length > 0);
	});

	it("has no orphaned stages (every stage is reachable from LEAD)", () => {
		const reachable = new Set(["LEAD"]);
		const queue = ["LEAD"];
		while (queue.length > 0) {
			const current = queue.shift();
			const stage = pipelineStages.find((s) => s.key === current);
			if (stage) {
				for (const next of stage.next) {
					if (!reachable.has(next)) {
						reachable.add(next);
						queue.push(next);
					}
				}
			}
		}
		const unreachable = pipelineStages.filter((s) => !reachable.has(s.key));
		assert.deepStrictEqual(
			unreachable.map((s) => s.key),
			[],
			`unreachable stages: ${unreachable.map((s) => s.key).join(", ")}`,
		);
	});

	it("formatCurrency uses config locale and currency", () => {
		const formatted = formatCurrency(1000);
		assert.equal(typeof formatted, "string");
		assert.ok(formatted.includes("1"));
	});

	it("formatCurrency accepts locale/currency overrides", () => {
		const formatted = formatCurrency(1000, {
			locale: "en-US",
			currency: "EUR",
		});
		assert.ok(formatted.includes("€") || formatted.includes("EUR"));
	});
});

function mockAppConfigPrisma(overrides = {}) {
	return {
		appConfig: {
			findUnique: mock.fn(async () => null),
			upsert: mock.fn(async ({ create, update }) => ({
				id: "cfg-1",
				key: "crm",
				value: update?.value ?? create?.value,
			})),
			...overrides.appConfig,
		},
		...overrides,
	};
}

describe("getCrmConfig / updateCrmConfig", () => {
	let originalPrisma;

	beforeEach(() => {
		originalPrisma = globalThis.__prisma;
		delete globalThis.__prisma;
	});

	afterEach(() => {
		if (originalPrisma !== undefined) {
			globalThis.__prisma = originalPrisma;
		} else {
			delete globalThis.__prisma;
		}
	});

	it("getCrmConfig returns defaults when no DB row exists", async () => {
		const db = mockAppConfigPrisma();
		globalThis.__prisma = db;

		const config = await getCrmConfig();
		assert.equal(config.entityLabel, DEFAULT_CRM_CONFIG.entityLabel);
		assert.equal(
			config.entityPluralLabel,
			DEFAULT_CRM_CONFIG.entityPluralLabel,
		);
		assert.equal(config.pipelineStages.length, 6);
		assert.equal(db.appConfig.findUnique.mock.callCount(), 1);
		assert.deepStrictEqual(db.appConfig.findUnique.mock.calls[0].arguments[0], {
			where: { key: "crm" },
		});
	});

	it("getCrmConfig returns stored value when row exists", async () => {
		const stored = {
			entityLabel: "Opportunity",
			entityPluralLabel: "Opportunities",
			containerLabel: "Account",
			containerPluralLabel: "Accounts",
			actorLabel: "Lead",
			actorPluralLabel: "Leads",
			pipelineStages: [
				{
					key: "NEW",
					label: "New",
					color: "default",
					probability: 5,
					next: [],
				},
			],
			currency: "GBP",
			locale: "en-GB",
			defaultPageSize: 10,
			fields: DEFAULT_CRM_CONFIG.fields,
		};

		globalThis.__prisma = mockAppConfigPrisma({
			appConfig: {
				findUnique: mock.fn(async () => ({
					id: "cfg-1",
					key: "crm",
					value: stored,
				})),
			},
		});

		const config = await getCrmConfig();
		assert.equal(config.entityLabel, "Opportunity");
		assert.equal(config.entityPluralLabel, "Opportunities");
		assert.equal(config.pipelineStages[0].key, "NEW");
		assert.equal(config.currency, "GBP");
	});

	it("updateCrmConfig upserts merged config", async () => {
		const findUnique = mock.fn(async () => null);
		const upsert = mock.fn(async ({ create }) => ({
			id: "new-id",
			key: "crm",
			value: create.value,
		}));

		globalThis.__prisma = mockAppConfigPrisma({
			appConfig: { findUnique, upsert },
		});

		const config = await updateCrmConfig({
			entityLabel: "Ticket",
			entityPluralLabel: "Tickets",
		});

		assert.equal(upsert.mock.callCount(), 1);
		const args = upsert.mock.calls[0].arguments[0];
		assert.deepStrictEqual(args.where, { key: "crm" });
		assert.equal(args.create.key, "crm");
		assert.equal(args.create.value.entityLabel, "Ticket");
		assert.equal(args.create.value.entityPluralLabel, "Tickets");
		assert.equal(args.create.value.currency, DEFAULT_CRM_CONFIG.currency);
		assert.equal(config.entityLabel, "Ticket");
	});

	it("updateCrmConfig merges with existing row", async () => {
		const existing = {
			...DEFAULT_CRM_CONFIG,
			entityLabel: "Deal",
			currency: "USD",
		};

		const findUnique = mock.fn(async () => ({
			id: "existing-id",
			key: "crm",
			value: existing,
		}));
		const upsert = mock.fn(async ({ update }) => ({
			id: "existing-id",
			key: "crm",
			value: update.value,
		}));

		globalThis.__prisma = mockAppConfigPrisma({
			appConfig: { findUnique, upsert },
		});

		const config = await updateCrmConfig({ currency: "JPY" });
		assert.equal(upsert.mock.callCount(), 1);
		assert.equal(config.currency, "JPY");
		assert.equal(config.entityLabel, "Deal");
	});
});
