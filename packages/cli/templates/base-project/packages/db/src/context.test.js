import assert from "node:assert";
import { describe, test } from "node:test";
import {
	getRelevantContext,
	hashInput,
	shouldProcess,
	summarizeContext,
} from "./context.js";

// ── getRelevantContext ───────────────────────────────────────────────────────

describe("getRelevantContext", () => {
	test("returns empty records and summary when question is empty", () => {
		const result = getRelevantContext("", [
			{ key: "test", value: "val", category: "client" },
		]);
		assert.deepStrictEqual(result.records, []);
		assert.strictEqual(result.summary, "No business context available.");
	});

	test("returns empty records and summary when records is empty", () => {
		const result = getRelevantContext("What is the billing info?", []);
		assert.deepStrictEqual(result.records, []);
		assert.strictEqual(result.summary, "No business context available.");
	});

	test("returns empty records and summary when records is null", () => {
		const result = getRelevantContext("test", null);
		assert.deepStrictEqual(result.records, []);
	});

	test("returns relevant records when question matches category keywords", () => {
		const records = [
			{
				key: "billing.plan",
				value: "Enterprise plan",
				category: "billing",
				source: "seed",
			},
			{
				key: "client.acme",
				value: "Acme Corp",
				category: "client",
				source: "learned",
			},
		];

		const result = getRelevantContext("What is the billing plan?", records);
		assert.ok(result.records.length > 0);
		assert.ok(result.summary === null);
		assert.strictEqual(result.records[0].category, "billing");
	});

	test("returns relevant records when question matches key words", () => {
		const records = [
			{
				key: "client.acme.industry",
				value: "Technology",
				category: "client",
				source: "learned",
			},
			{
				key: "task.reports",
				value: "Weekly reports",
				category: "task",
				source: "seed",
			},
		];

		const result = getRelevantContext("Tell me about acme", records);
		assert.ok(result.records.length > 0);
		assert.strictEqual(result.records[0].key, "client.acme.industry");
	});

	test("returns summary when no records score above minScore", () => {
		const records = [
			{
				key: "xyz.random",
				value: "Unrelated",
				category: "preference",
				source: "seed",
			},
		];

		const result = getRelevantContext("billing information", records, {
			minScore: 5,
		});
		assert.deepStrictEqual(result.records, []);
		assert.ok(result.summary);
		assert.ok(result.summary.includes("records"));
	});

	test("respects maxRecords option", () => {
		const records = [];
		for (let i = 0; i < 20; i++) {
			records.push({
				key: `billing.item${i}`,
				value: `Billing item ${i}`,
				category: "billing",
				source: "learned",
			});
		}

		const result = getRelevantContext("billing payment invoice", records, {
			maxRecords: 5,
		});
		assert.ok(result.records.length <= 5);
	});

	test("sorts records by relevance score (highest first)", () => {
		const records = [
			{
				key: "client.low",
				value: "Low match",
				category: "preference",
				source: "seed",
			},
			{
				key: "billing.high",
				value: "High match billing",
				category: "billing",
				source: "seed",
			},
		];

		const result = getRelevantContext("billing payment plan invoice", records);
		if (result.records.length >= 2) {
			// billing record should rank higher
			const billingIdx = result.records.findIndex(
				(r) => r.category === "billing",
			);
			const prefIdx = result.records.findIndex(
				(r) => r.category === "preference",
			);
			if (billingIdx !== -1 && prefIdx !== -1) {
				assert.ok(
					billingIdx < prefIdx,
					"Billing should rank higher than preference",
				);
			}
		}
	});

	test("uses custom keyword map when provided", () => {
		const records = [
			{
				key: "custom.topic",
				value: "Custom value",
				category: "custom_cat",
				source: "seed",
			},
		];

		const customMap = {
			custom_cat: ["custom", "special", "unique"],
		};

		const result = getRelevantContext("This is custom", records, {
			keywordMap: customMap,
		});
		assert.ok(result.records.length > 0);
	});
});

// ── summarizeContext ─────────────────────────────────────────────────────────

describe("summarizeContext", () => {
	test("returns default message for empty records", () => {
		const result = summarizeContext([]);
		assert.strictEqual(result, "No business context available.");
	});

	test("returns default message for null records", () => {
		const result = summarizeContext(null);
		assert.strictEqual(result, "No business context available.");
	});

	test("creates summary with category breakdown", () => {
		const records = [
			{ key: "billing.a", value: "A", category: "billing", source: "seed" },
			{ key: "billing.b", value: "B", category: "billing", source: "learned" },
			{ key: "client.a", value: "C", category: "client", source: "seed" },
		];

		const result = summarizeContext(records);
		assert.ok(result.includes("3 records"));
		assert.ok(result.includes("2 curated"));
		assert.ok(result.includes("1 learned"));
		assert.ok(result.includes("Billing"));
		assert.ok(result.includes("Client"));
	});

	test("capitalizes category names", () => {
		const records = [
			{ key: "tech_note.a", value: "A", category: "tech_note", source: "seed" },
		];

		const result = summarizeContext(records);
		assert.ok(result.includes("Tech_note"));
	});

	test("includes usage hint at the end", () => {
		const records = [
			{ key: "a", value: "A", category: "billing", source: "seed" },
		];

		const result = summarizeContext(records);
		assert.ok(result.includes("getRelevantContext"));
	});
});

// ── hashInput ────────────────────────────────────────────────────────────────

describe("hashInput", () => {
	test("returns null for empty string", () => {
		assert.strictEqual(hashInput(""), null);
	});

	test("returns null for null input", () => {
		assert.strictEqual(hashInput(null), null);
	});

	test("returns null for undefined input", () => {
		assert.strictEqual(hashInput(undefined), null);
	});

	test("returns null for non-string input", () => {
		assert.strictEqual(hashInput(123), null);
		assert.strictEqual(hashInput({}), null);
	});

	test("returns null for whitespace-only string", () => {
		assert.strictEqual(hashInput("   "), null);
	});

	test("returns a hex string for valid input", () => {
		const hash = hashInput("Hello, world!");
		assert.ok(typeof hash === "string");
		assert.ok(hash.length > 0);
		assert.ok(/^[0-9a-f]+$/.test(hash), "Hash should be hexadecimal");
	});

	test("returns consistent hash for same input", () => {
		const hash1 = hashInput("test input");
		const hash2 = hashInput("test input");
		assert.strictEqual(hash1, hash2);
	});

	test("returns different hash for different input", () => {
		const hash1 = hashInput("input one");
		const hash2 = hashInput("input two");
		assert.notStrictEqual(hash1, hash2);
	});

	test("trims whitespace before hashing", () => {
		const hash1 = hashInput("hello");
		const hash2 = hashInput("  hello  ");
		assert.strictEqual(hash1, hash2);
	});
});

// ── shouldProcess ────────────────────────────────────────────────────────────

describe("shouldProcess", () => {
	test("returns shouldProcess: false for empty input", () => {
		const result = shouldProcess("", null);
		assert.strictEqual(result.shouldProcess, false);
		assert.strictEqual(result.hash, null);
	});

	test("returns shouldProcess: true when no previous hash", () => {
		const result = shouldProcess("new data", null);
		assert.strictEqual(result.shouldProcess, true);
		assert.ok(result.hash);
	});

	test("returns shouldProcess: true when hash changed", () => {
		const result = shouldProcess("new data", "old-hash");
		assert.strictEqual(result.shouldProcess, true);
		assert.ok(result.hash);
	});

	test("returns shouldProcess: false when hash unchanged", () => {
		const hash = hashInput("same data");
		const result = shouldProcess("same data", hash);
		assert.strictEqual(result.shouldProcess, false);
		assert.strictEqual(result.hash, hash);
	});

	test("returns consistent hash", () => {
		const result1 = shouldProcess("test", null);
		const result2 = shouldProcess("test", null);
		assert.strictEqual(result1.hash, result2.hash);
	});
});
