import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import {
	DEFAULT_CRM_CONFIG,
	formatCurrency,
	loadCrmConfig,
	mapConfigToRow,
	mapRowToConfig,
	updateCrmConfig,
} from "./config.js";

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

describe("mapRowToConfig / mapConfigToRow", () => {
	it("maps DB plural fields to *PluralLabel keys", () => {
		const config = mapRowToConfig({
			id: "cfg-1",
			entityLabel: "Ticket",
			entityPlural: "Tickets",
			containerLabel: "Org",
			containerPlural: "Orgs",
			actorLabel: "Person",
			actorPlural: "People",
			pipelineStages: DEFAULT_CRM_CONFIG.pipelineStages,
			currency: "EUR",
			locale: "de-DE",
			defaultPageSize: 50,
			fields: DEFAULT_CRM_CONFIG.fields,
		});

		assert.equal(config.id, "cfg-1");
		assert.equal(config.entityLabel, "Ticket");
		assert.equal(config.entityPluralLabel, "Tickets");
		assert.equal(config.containerPluralLabel, "Orgs");
		assert.equal(config.actorPluralLabel, "People");
		assert.equal(config.currency, "EUR");
		assert.equal(config.defaultPageSize, 50);
	});

	it("maps *PluralLabel keys back to DB plural columns", () => {
		const row = mapConfigToRow({
			entityLabel: "Ticket",
			entityPluralLabel: "Tickets",
			actorPluralLabel: "People",
			currency: "GBP",
		});
		assert.deepStrictEqual(row, {
			entityLabel: "Ticket",
			entityPlural: "Tickets",
			actorPlural: "People",
			currency: "GBP",
		});
	});
});

function mockCrmPrisma(overrides = {}) {
	return {
		crmConfig: {
			findFirst: mock.fn(async () => null),
			create: mock.fn(async ({ data }) => ({
				id: "new-id",
				...data,
			})),
			update: mock.fn(async ({ data }) => ({
				id: "existing-id",
				entityLabel: "Deal",
				entityPlural: "Deals",
				containerLabel: "Company",
				containerPlural: "Companies",
				actorLabel: "Contact",
				actorPlural: "Contacts",
				pipelineStages: DEFAULT_CRM_CONFIG.pipelineStages,
				currency: "USD",
				locale: "en-US",
				defaultPageSize: 25,
				fields: DEFAULT_CRM_CONFIG.fields,
				...data,
			})),
			...overrides.crmConfig,
		},
		...overrides,
	};
}

describe("loadCrmConfig", () => {
	it("returns defaults when no DB row exists", async () => {
		const db = mockCrmPrisma();
		const config = await loadCrmConfig(db);
		assert.equal(config.entityLabel, DEFAULT_CRM_CONFIG.entityLabel);
		assert.equal(
			config.entityPluralLabel,
			DEFAULT_CRM_CONFIG.entityPluralLabel,
		);
		assert.equal(config.pipelineStages.length, 6);
		assert.equal(db.crmConfig.findFirst.mock.callCount(), 1);
	});

	it("returns mapped row when DB row exists", async () => {
		const db = mockCrmPrisma({
			crmConfig: {
				findFirst: mock.fn(async () => ({
					id: "cfg-1",
					entityLabel: "Opportunity",
					entityPlural: "Opportunities",
					containerLabel: "Account",
					containerPlural: "Accounts",
					actorLabel: "Lead",
					actorPlural: "Leads",
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
				})),
			},
		});

		const config = await loadCrmConfig(db);
		assert.equal(config.id, "cfg-1");
		assert.equal(config.entityLabel, "Opportunity");
		assert.equal(config.entityPluralLabel, "Opportunities");
		assert.equal(config.pipelineStages[0].key, "NEW");
		assert.equal(config.currency, "GBP");
	});

	it("falls back to defaults when prisma throws", async () => {
		const db = mockCrmPrisma({
			crmConfig: {
				findFirst: mock.fn(async () => {
					throw new Error("db down");
				}),
			},
		});
		const config = await loadCrmConfig(db);
		assert.equal(config.entityLabel, DEFAULT_CRM_CONFIG.entityLabel);
	});
});

describe("updateCrmConfig", () => {
	it("creates a row when none exists", async () => {
		const db = mockCrmPrisma();
		const config = await updateCrmConfig(
			{ entityLabel: "Ticket", entityPluralLabel: "Tickets" },
			db,
		);
		assert.equal(db.crmConfig.create.mock.callCount(), 1);
		assert.equal(config.entityLabel, "Ticket");
		assert.equal(config.entityPluralLabel, "Tickets");
	});

	it("updates the existing row", async () => {
		const db = mockCrmPrisma({
			crmConfig: {
				findFirst: mock.fn(async () => ({
					id: "existing-id",
					entityLabel: "Deal",
					entityPlural: "Deals",
					containerLabel: "Company",
					containerPlural: "Companies",
					actorLabel: "Contact",
					actorPlural: "Contacts",
					pipelineStages: DEFAULT_CRM_CONFIG.pipelineStages,
					currency: "USD",
					locale: "en-US",
					defaultPageSize: 25,
					fields: DEFAULT_CRM_CONFIG.fields,
				})),
				update: mock.fn(async ({ where, data }) => ({
					id: where.id,
					entityLabel: "Deal",
					entityPlural: "Deals",
					containerLabel: "Company",
					containerPlural: "Companies",
					actorLabel: "Contact",
					actorPlural: "Contacts",
					pipelineStages: DEFAULT_CRM_CONFIG.pipelineStages,
					currency: "USD",
					locale: "en-US",
					defaultPageSize: 25,
					fields: DEFAULT_CRM_CONFIG.fields,
					...data,
				})),
			},
		});

		const config = await updateCrmConfig({ currency: "JPY" }, db);
		assert.equal(db.crmConfig.update.mock.callCount(), 1);
		assert.equal(config.currency, "JPY");
		assert.equal(config.id, "existing-id");
	});
});
