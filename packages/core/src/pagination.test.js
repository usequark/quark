import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "./errors.js";
import {
	paginationMeta,
	paginationToSkip,
	parsePagination,
	parsePaginationQuery,
} from "./pagination.js";

// ─── parsePagination ──────────────────────────────────────────────────────────

describe("parsePagination", () => {
	describe("from URLSearchParams", () => {
		it("returns defaults when no params are given", () => {
			const result = parsePagination(new URLSearchParams());
			assert.deepEqual(result, { page: 1, limit: 20 });
		});

		it("parses page and limit", () => {
			const result = parsePagination(new URLSearchParams("page=3&limit=50"));
			assert.deepEqual(result, { page: 3, limit: 50 });
		});

		it("coerces string numbers", () => {
			const result = parsePagination(new URLSearchParams("page=2&limit=10"));
			assert.equal(typeof result.page, "number");
			assert.equal(typeof result.limit, "number");
		});
	});

	describe("from plain object", () => {
		it("accepts a plain object", () => {
			const result = parsePagination({ page: "2", limit: "10" });
			assert.deepEqual(result, { page: 2, limit: 10 });
		});

		it("uses defaults for undefined values", () => {
			const result = parsePagination({});
			assert.deepEqual(result, { page: 1, limit: 20 });
		});

		it("ignores null values and uses defaults", () => {
			const result = parsePagination({ page: null, limit: null });
			assert.deepEqual(result, { page: 1, limit: 20 });
		});
	});

	describe("validation", () => {
		it("throws ValidationError for page < 1", () => {
			assert.throws(
				() => parsePagination({ page: "0" }),
				(err) => err instanceof ValidationError,
			);
		});

		it("throws ValidationError for non-integer page", () => {
			assert.throws(
				() => parsePagination({ page: "1.5" }),
				(err) => err instanceof ValidationError,
			);
		});

		it("throws ValidationError for limit > maxLimit (default 100)", () => {
			assert.throws(
				() => parsePagination({ limit: "101" }),
				(err) => err instanceof ValidationError,
			);
		});

		it("respects custom maxLimit option", () => {
			const result = parsePagination({ limit: "200" }, { maxLimit: 500 });
			assert.equal(result.limit, 200);
		});

		it("throws when limit exceeds custom maxLimit", () => {
			assert.throws(
				() => parsePagination({ limit: "51" }, { maxLimit: 50 }),
				(err) => err instanceof ValidationError,
			);
		});
	});
});

// ─── paginationToSkip ─────────────────────────────────────────────────────────

describe("paginationToSkip", () => {
	it("page 1 → skip 0", () => {
		assert.deepEqual(paginationToSkip({ page: 1, limit: 20 }), {
			skip: 0,
			take: 20,
		});
	});

	it("page 2 limit 20 → skip 20", () => {
		assert.deepEqual(paginationToSkip({ page: 2, limit: 20 }), {
			skip: 20,
			take: 20,
		});
	});

	it("page 3 limit 10 → skip 20", () => {
		assert.deepEqual(paginationToSkip({ page: 3, limit: 10 }), {
			skip: 20,
			take: 10,
		});
	});

	it("page 5 limit 100 → skip 400", () => {
		assert.deepEqual(paginationToSkip({ page: 5, limit: 100 }), {
			skip: 400,
			take: 100,
		});
	});
});

// ─── paginationMeta ───────────────────────────────────────────────────────────

describe("paginationMeta", () => {
	it("calculates totalPages correctly", () => {
		const meta = paginationMeta({ page: 1, limit: 20, total: 100 });
		assert.equal(meta.totalPages, 5);
	});

	it("rounds totalPages up for non-divisible totals", () => {
		const meta = paginationMeta({ page: 1, limit: 20, total: 101 });
		assert.equal(meta.totalPages, 6);
	});

	it("hasNext is true when not on last page", () => {
		const meta = paginationMeta({ page: 2, limit: 10, total: 50 });
		assert.equal(meta.hasNext, true);
	});

	it("hasNext is false on last page", () => {
		const meta = paginationMeta({ page: 5, limit: 10, total: 50 });
		assert.equal(meta.hasNext, false);
	});

	it("hasPrev is true when not on first page", () => {
		const meta = paginationMeta({ page: 3, limit: 10, total: 50 });
		assert.equal(meta.hasPrev, true);
	});

	it("hasPrev is false on first page", () => {
		const meta = paginationMeta({ page: 1, limit: 10, total: 50 });
		assert.equal(meta.hasPrev, false);
	});

	it("returns total, page, limit in metadata", () => {
		const meta = paginationMeta({ page: 2, limit: 10, total: 45 });
		assert.equal(meta.total, 45);
		assert.equal(meta.page, 2);
		assert.equal(meta.limit, 10);
	});

	it("handles total of 0", () => {
		const meta = paginationMeta({ page: 1, limit: 20, total: 0 });
		assert.equal(meta.totalPages, 0);
		assert.equal(meta.hasNext, false);
		assert.equal(meta.hasPrev, false);
	});

	it("handles single page result", () => {
		const meta = paginationMeta({ page: 1, limit: 20, total: 5 });
		assert.equal(meta.totalPages, 1);
		assert.equal(meta.hasNext, false);
		assert.equal(meta.hasPrev, false);
	});
});

// ─── parsePaginationQuery ─────────────────────────────────────────────────────

describe("parsePaginationQuery", () => {
	it("returns page, limit, skip, take, and meta function", () => {
		const sp = new URLSearchParams("page=2&limit=15");
		const result = parsePaginationQuery(sp);
		assert.equal(result.page, 2);
		assert.equal(result.limit, 15);
		assert.equal(result.skip, 15);
		assert.equal(result.take, 15);
		assert.equal(typeof result.meta, "function");
	});

	it("meta(total) returns correct pagination envelope", () => {
		const result = parsePaginationQuery(new URLSearchParams("page=2&limit=10"));
		const meta = result.meta(45);
		assert.deepEqual(meta, {
			total: 45,
			page: 2,
			limit: 10,
			totalPages: 5,
			hasNext: true,
			hasPrev: true,
		});
	});

	it("uses defaults when no params are provided", () => {
		const result = parsePaginationQuery(new URLSearchParams());
		assert.equal(result.skip, 0);
		assert.equal(result.take, 20);
	});

	it("propagates ValidationError on invalid input", () => {
		assert.throws(
			() => parsePaginationQuery(new URLSearchParams("page=0")),
			(err) => err instanceof ValidationError,
		);
	});
});
