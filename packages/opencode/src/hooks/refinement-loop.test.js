import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import { refinementLoop } from "./refinement-loop.js";

const ENTRY_TTL_MS = 5 * 60 * 1000;

/**
 * @param {string} sessionID
 */
function makeInput(sessionID) {
	return { sessionID };
}

function makeOutput() {
	return { context: /** @type {string[]} */ ([]) };
}

describe("refinementLoop", () => {
	afterEach(() => {
		mock.timers.reset();
	});

	test("injects quality gate context on first call", async () => {
		const output = makeOutput();
		await refinementLoop(makeInput("basic-session"), output);

		assert.equal(output.context.length, 1);
		assert.match(output.context[0], /Techstream Quality Gate/);
		assert.match(output.context[0], /Refinement iteration: 1\/3/);
		assert.match(output.context[0], /Brand voice consistency/);
		assert.match(output.context[0], /SEO keyword presence/);
		assert.match(output.context[0], /Accessibility compliance/);
	});

	test("increments iteration count per session", async () => {
		const sessionID = `iter-${Date.now()}-${Math.random()}`;

		const out1 = makeOutput();
		await refinementLoop(makeInput(sessionID), out1);
		assert.match(out1.context[0], /Refinement iteration: 1\/3/);
		assert.equal(out1.context.length, 1);

		const out2 = makeOutput();
		await refinementLoop(makeInput(sessionID), out2);
		assert.match(out2.context[0], /Refinement iteration: 2\/3/);
		assert.equal(out2.context.length, 1);

		const out3 = makeOutput();
		await refinementLoop(makeInput(sessionID), out3);
		assert.match(out3.context[0], /Refinement iteration: 3\/3/);
		assert.equal(out3.context.length, 2);
		assert.match(out3.context[1], /Techstream Refinement Limit/);
		assert.match(out3.context[1], /maximum of 3 refinement iterations/);
	});

	test("tracks iteration counts independently per session", async () => {
		const sessionA = `session-a-${Date.now()}-${Math.random()}`;
		const sessionB = `session-b-${Date.now()}-${Math.random()}`;

		const outA1 = makeOutput();
		await refinementLoop(makeInput(sessionA), outA1);
		assert.match(outA1.context[0], /Refinement iteration: 1\/3/);

		const outB1 = makeOutput();
		await refinementLoop(makeInput(sessionB), outB1);
		assert.match(outB1.context[0], /Refinement iteration: 1\/3/);

		const outA2 = makeOutput();
		await refinementLoop(makeInput(sessionA), outA2);
		assert.match(outA2.context[0], /Refinement iteration: 2\/3/);
	});

	test("TTL eviction resets iteration count after expiry", async () => {
		mock.timers.enable({ apis: ["Date"], now: 1_000_000 });

		const sessionID = `ttl-${Date.now()}-${Math.random()}`;

		const out1 = makeOutput();
		await refinementLoop(makeInput(sessionID), out1);
		assert.match(out1.context[0], /Refinement iteration: 1\/3/);

		const out2 = makeOutput();
		await refinementLoop(makeInput(sessionID), out2);
		assert.match(out2.context[0], /Refinement iteration: 2\/3/);

		// Advance past TTL
		mock.timers.tick(ENTRY_TTL_MS + 1);

		const out3 = makeOutput();
		await refinementLoop(makeInput(sessionID), out3);
		assert.match(out3.context[0], /Refinement iteration: 1\/3/);
		assert.equal(out3.context.length, 1);
	});

	test("entries within TTL retain their count", async () => {
		mock.timers.enable({ apis: ["Date"], now: 2_000_000 });

		const sessionID = `ttl-retain-${Date.now()}-${Math.random()}`;

		const out1 = makeOutput();
		await refinementLoop(makeInput(sessionID), out1);
		assert.match(out1.context[0], /Refinement iteration: 1\/3/);

		// Advance but stay within TTL
		mock.timers.tick(ENTRY_TTL_MS - 1000);

		const out2 = makeOutput();
		await refinementLoop(makeInput(sessionID), out2);
		assert.match(out2.context[0], /Refinement iteration: 2\/3/);
	});
});
