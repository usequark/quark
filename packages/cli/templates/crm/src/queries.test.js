import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { DEFAULT_CRM_CONFIG } from "./config.js";
import { getCompanyMetrics, getPipelineSummary } from "./queries.js";

function mockPrisma(overrides = {}) {
	return {
		deal: {
			findMany: mock.fn(async () => []),
			count: mock.fn(async () => 0),
			...overrides.deal,
		},
		contact: {
			count: mock.fn(async () => 0),
			...overrides.contact,
		},
		...overrides,
	};
}

describe("getPipelineSummary", () => {
	it("returns empty stages when no deals exist", async () => {
		const prisma = mockPrisma();
		const result = await getPipelineSummary(prisma, DEFAULT_CRM_CONFIG);
		assert.ok(Array.isArray(result.stages));
		assert.equal(result.stages.length, 6); // 6 pipeline stages
		assert.equal(result.totalPipelineValue, 0);
		assert.equal(result.totalExpectedValue, 0);
	});

	it("calls prisma.deal.findMany with correct stage filter", async () => {
		const prisma = mockPrisma();
		await getPipelineSummary(prisma, DEFAULT_CRM_CONFIG);
		const calls = prisma.deal.findMany.mock.calls;
		// Should be called once per pipeline stage
		assert.equal(calls.length, 6);
		// First call filters by LEAD stage
		assert.deepStrictEqual(calls[0].arguments[0].where, { stage: "LEAD" });
		// Should include contact and company relations
		assert.ok(calls[0].arguments[0].include.contact);
		assert.ok(calls[0].arguments[0].include.company);
	});

	it("calculates totalValue and expectedValue correctly", async () => {
		const prisma = mockPrisma({
			deal: {
				findMany: mock.fn(async ({ where }) => {
					if (where.stage === "NEGOTIATION") {
						return [
							{
								id: "deal-1",
								title: "Deal A",
								value: 10000,
								probability: 75,
								stage: "NEGOTIATION",
							},
							{
								id: "deal-2",
								title: "Deal B",
								value: 20000,
								probability: 50,
								stage: "NEGOTIATION",
							},
						];
					}
					return [];
				}),
			},
		});

		const result = await getPipelineSummary(prisma, DEFAULT_CRM_CONFIG);
		const negotiationStage = result.stages.find(
			(s) => s.stage === "NEGOTIATION",
		);
		assert.ok(negotiationStage);
		assert.equal(negotiationStage.totalValue, 30000);
		assert.equal(negotiationStage.expectedValue, 17500); // 10000*0.75 + 20000*0.50
		assert.equal(negotiationStage.count, 2);
	});

	it("calculates totalPipelineValue excluding terminal stages", async () => {
		const prisma = mockPrisma({
			deal: {
				findMany: mock.fn(async ({ where }) => {
					if (where.stage === "NEGOTIATION") {
						return [
							{
								id: "deal-1",
								title: "Active Deal",
								value: 50000,
								probability: 75,
								stage: "NEGOTIATION",
							},
						];
					}
					if (where.stage === "QUALIFIED") {
						return [
							{
								id: "deal-2",
								title: "Qualified Deal",
								value: 30000,
								probability: 25,
								stage: "QUALIFIED",
							},
						];
					}
					// No deals in LEAD, PROPOSAL, or terminal stages (CLOSED_WON, CLOSED_LOST)
					return [];
				}),
			},
		});

		const result = await getPipelineSummary(prisma, DEFAULT_CRM_CONFIG);
		// Only QUALIFIED (30000) + NEGOTIATION (50000) should count
		// LEAD has no deals, PROPOSAL has no deals, terminal stages excluded
		assert.equal(result.totalPipelineValue, 80000);
	});
});

describe("getCompanyMetrics", () => {
	it("returns zero metrics when no data exists", async () => {
		const prisma = mockPrisma();
		const result = await getCompanyMetrics(prisma, "cmp-1");
		assert.deepStrictEqual(result, {
			contactCount: 0,
			activeDeals: 0,
			wonDeals: 0,
		});
	});

	it("calls prisma.contact.count with correct company filter", async () => {
		const prisma = mockPrisma();
		await getCompanyMetrics(prisma, "cmp-1");
		assert.equal(prisma.contact.count.mock.callCount(), 1);
		assert.deepStrictEqual(prisma.contact.count.mock.calls[0].arguments[0], {
			where: { companyId: "cmp-1" },
		});
	});

	it("calls prisma.deal.count with correct filters", async () => {
		const prisma = mockPrisma();
		await getCompanyMetrics(prisma, "cmp-1");
		// Two deal.count calls: active deals and won deals
		assert.equal(prisma.deal.count.mock.callCount(), 2);
		assert.deepStrictEqual(prisma.deal.count.mock.calls[0].arguments[0], {
			where: {
				companyId: "cmp-1",
				stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
			},
		});
		assert.deepStrictEqual(prisma.deal.count.mock.calls[1].arguments[0], {
			where: { companyId: "cmp-1", stage: "CLOSED_WON" },
		});
	});

	it("returns correct counts from mocked data", async () => {
		const prisma = mockPrisma({
			contact: {
				count: mock.fn(async () => 5),
			},
			deal: {
				count: mock.fn(async ({ where }) => {
					if (where.stage?.notIn) return 3;
					return 2;
				}),
			},
		});

		const result = await getCompanyMetrics(prisma, "cmp-1");
		assert.deepStrictEqual(result, {
			contactCount: 5,
			activeDeals: 3,
			wonDeals: 2,
		});
	});
});
