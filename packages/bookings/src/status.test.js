import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyTransition, canTransition } from "./status.js";

describe("canTransition", () => {
	it("allows PENDING → CONFIRMED", () => {
		assert.equal(canTransition("PENDING", "CONFIRMED"), true);
	});

	it("allows PENDING → CANCELLED", () => {
		assert.equal(canTransition("PENDING", "CANCELLED"), true);
	});

	it("allows CONFIRMED → COMPLETED", () => {
		assert.equal(canTransition("CONFIRMED", "COMPLETED"), true);
	});

	it("allows CONFIRMED → CANCELLED", () => {
		assert.equal(canTransition("CONFIRMED", "CANCELLED"), true);
	});

	it("allows CONFIRMED → NO_SHOW", () => {
		assert.equal(canTransition("CONFIRMED", "NO_SHOW"), true);
	});

	it("rejects COMPLETED → anything", () => {
		assert.equal(canTransition("COMPLETED", "PENDING"), false);
		assert.equal(canTransition("COMPLETED", "CONFIRMED"), false);
		assert.equal(canTransition("COMPLETED", "CANCELLED"), false);
		assert.equal(canTransition("COMPLETED", "NO_SHOW"), false);
		assert.equal(canTransition("COMPLETED", "COMPLETED"), false);
	});

	it("rejects CANCELLED → anything", () => {
		assert.equal(canTransition("CANCELLED", "PENDING"), false);
		assert.equal(canTransition("CANCELLED", "CONFIRMED"), false);
		assert.equal(canTransition("CANCELLED", "COMPLETED"), false);
		assert.equal(canTransition("CANCELLED", "NO_SHOW"), false);
		assert.equal(canTransition("CANCELLED", "CANCELLED"), false);
	});

	it("rejects NO_SHOW → anything", () => {
		assert.equal(canTransition("NO_SHOW", "PENDING"), false);
		assert.equal(canTransition("NO_SHOW", "CONFIRMED"), false);
		assert.equal(canTransition("NO_SHOW", "COMPLETED"), false);
		assert.equal(canTransition("NO_SHOW", "CANCELLED"), false);
		assert.equal(canTransition("NO_SHOW", "NO_SHOW"), false);
	});

	it("rejects invalid transitions from PENDING", () => {
		assert.equal(canTransition("PENDING", "COMPLETED"), false);
		assert.equal(canTransition("PENDING", "NO_SHOW"), false);
		assert.equal(canTransition("PENDING", "PENDING"), false);
	});

	it("rejects unknown status", () => {
		assert.equal(canTransition("UNKNOWN", "CONFIRMED"), false);
		assert.equal(canTransition("PENDING", "UNKNOWN"), false);
	});
});

describe("applyTransition", () => {
	it("returns status patch for CONFIRMED", () => {
		const patch = applyTransition({ status: "PENDING" }, "CONFIRMED");
		assert.equal(patch.status, "CONFIRMED");
		assert.equal(patch.cancelledAt, undefined);
	});

	it("returns status patch for COMPLETED", () => {
		const patch = applyTransition({ status: "CONFIRMED" }, "COMPLETED");
		assert.equal(patch.status, "COMPLETED");
		assert.equal(patch.cancelledAt, undefined);
	});

	it("returns status patch for NO_SHOW", () => {
		const patch = applyTransition({ status: "CONFIRMED" }, "NO_SHOW");
		assert.equal(patch.status, "NO_SHOW");
		assert.equal(patch.cancelledAt, undefined);
	});

	it("sets cancelledAt when transitioning to CANCELLED", () => {
		const before = Date.now();
		const patch = applyTransition({ status: "CONFIRMED" }, "CANCELLED");
		assert.equal(patch.status, "CANCELLED");
		assert.ok(patch.cancelledAt instanceof Date);
		assert.ok(patch.cancelledAt.getTime() >= before);
	});

	it("generates cancelToken when transitioning to PENDING without one", () => {
		const patch = applyTransition({ status: "DRAFT" }, "PENDING");
		assert.equal(patch.status, "PENDING");
		assert.equal(typeof patch.cancelToken, "string");
		assert.ok(patch.cancelToken.length > 0);
	});

	it("does not generate cancelToken when booking already has one", () => {
		const patch = applyTransition(
			{ status: "DRAFT", cancelToken: "existing-token" },
			"PENDING",
		);
		assert.equal(patch.status, "PENDING");
		assert.equal(patch.cancelToken, undefined);
	});

	it("does not mutate the input booking", () => {
		const booking = { status: "PENDING", cancelToken: null };
		const before = { ...booking };
		applyTransition(booking, "CANCELLED");
		assert.deepEqual(booking, before);
	});
});
