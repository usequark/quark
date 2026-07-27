import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crmConfig } from "./config.js";

describe("crmConfig", () => {
	const { pipelineStages } = crmConfig;
	const stageKeys = pipelineStages.map((s) => s.key);

	it("exports a non-empty pipelineStages array", () => {
		assert.ok(Array.isArray(pipelineStages));
		assert.ok(pipelineStages.length > 0);
	});

	it("has unique stage keys", () => {
		assert.strictEqual(new Set(stageKeys).size, stageKeys.length);
	});

	it("has a defaultPageSize", () => {
		assert.equal(typeof crmConfig.defaultPageSize, "number");
		assert.ok(crmConfig.defaultPageSize > 0);
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
});
