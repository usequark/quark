import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTransition, canTransition } from "./status.js";

// ─── canTransition ────────────────────────────────────────────────────────────

test("canTransition — DRAFT → PUBLISHED is valid", () => {
	assert.equal(canTransition("DRAFT", "PUBLISHED"), true);
});

test("canTransition — DRAFT → ARCHIVED is invalid", () => {
	assert.equal(canTransition("DRAFT", "ARCHIVED"), false);
});

test("canTransition — DRAFT → DRAFT is invalid (no self-transition)", () => {
	assert.equal(canTransition("DRAFT", "DRAFT"), false);
});

test("canTransition — PUBLISHED → DRAFT is valid", () => {
	assert.equal(canTransition("PUBLISHED", "DRAFT"), true);
});

test("canTransition — PUBLISHED → ARCHIVED is valid", () => {
	assert.equal(canTransition("PUBLISHED", "ARCHIVED"), true);
});

test("canTransition — PUBLISHED → PUBLISHED is invalid", () => {
	assert.equal(canTransition("PUBLISHED", "PUBLISHED"), false);
});

test("canTransition — ARCHIVED → DRAFT is valid", () => {
	assert.equal(canTransition("ARCHIVED", "DRAFT"), true);
});

test("canTransition — ARCHIVED → PUBLISHED is invalid", () => {
	assert.equal(canTransition("ARCHIVED", "PUBLISHED"), false);
});

test("canTransition — unknown status returns false", () => {
	assert.equal(canTransition("UNKNOWN", "PUBLISHED"), false);
});

// ─── applyTransition ──────────────────────────────────────────────────────────

test("applyTransition — PUBLISHED sets publishedAt when not already set", () => {
	const record = { status: "DRAFT", publishedAt: null };
	const patch = applyTransition(record, "PUBLISHED");
	assert.equal(patch.status, "PUBLISHED");
	assert.ok(patch.publishedAt instanceof Date);
});

test("applyTransition — PUBLISHED does not overwrite existing publishedAt", () => {
	const existing = new Date("2024-01-01");
	const record = { status: "DRAFT", publishedAt: existing };
	const patch = applyTransition(record, "PUBLISHED");
	assert.equal(patch.publishedAt, undefined); // no override
	assert.equal(patch.status, "PUBLISHED");
});

test("applyTransition — DRAFT clears publishedAt", () => {
	const record = { status: "PUBLISHED", publishedAt: new Date() };
	const patch = applyTransition(record, "DRAFT");
	assert.equal(patch.status, "DRAFT");
	assert.equal(patch.publishedAt, null);
});

test("applyTransition — ARCHIVED preserves publishedAt (does not touch it)", () => {
	const record = { status: "PUBLISHED", publishedAt: new Date("2024-06-01") };
	const patch = applyTransition(record, "ARCHIVED");
	assert.equal(patch.status, "ARCHIVED");
	assert.equal(patch.publishedAt, undefined); // not set on patch
});

test("applyTransition — does not mutate the input record", () => {
	const record = { status: "DRAFT", publishedAt: null };
	const before = { ...record };
	applyTransition(record, "PUBLISHED");
	assert.deepEqual(record, before);
});
