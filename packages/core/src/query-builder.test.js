import assert from "node:assert";
import { describe, test } from "node:test";
import { createQueryBuilder, QueryBuilder } from "./query-builder.js";

describe("QueryBuilder - Filter", () => {
	test("adds simple equality filter", () => {
		const qb = new QueryBuilder({
			filterableFields: ["status", "category"],
		});

		qb.filter("status", "eq", "published");
		const where = qb.toWhere();

		assert.deepStrictEqual(where, { status: { equals: "published" } });
	});

	test("adds multiple filters with AND", () => {
		const qb = new QueryBuilder({
			filterableFields: ["status", "authorId"],
		});

		qb.filter("status", "eq", "published").filter("authorId", "eq", "user-123");

		const where = qb.toWhere();
		assert.deepStrictEqual(where, {
			AND: [
				{ status: { equals: "published" } },
				{ authorId: { equals: "user-123" } },
			],
		});
	});

	test("supports contains operator", () => {
		const qb = new QueryBuilder({ filterableFields: ["title"] });
		qb.filter("title", "contains", "hello");

		assert.deepStrictEqual(qb.toWhere(), { title: { contains: "hello" } });
	});

	test("supports gt/gte/lt/lte operators", () => {
		const qb = new QueryBuilder({ filterableFields: ["views"] });
		qb.filter("views", "gte", 100);

		assert.deepStrictEqual(qb.toWhere(), { views: { gte: 100 } });
	});

	test("supports in operator with array", () => {
		const qb = new QueryBuilder({ filterableFields: ["category"] });
		qb.filter("category", "in", ["tech", "science"]);

		assert.deepStrictEqual(qb.toWhere(), {
			category: { in: ["tech", "science"] },
		});
	});

	test("supports not (ne) operator", () => {
		const qb = new QueryBuilder({ filterableFields: ["status"] });
		qb.filter("status", "ne", "draft");

		assert.deepStrictEqual(qb.toWhere(), { status: { not: "draft" } });
	});

	test("throws on non-filterable field", () => {
		const qb = new QueryBuilder({ filterableFields: ["status"] });
		assert.throws(() => qb.filter("password", "eq", "test"), /not filterable/);
	});

	test("throws on invalid operator", () => {
		const qb = new QueryBuilder({ filterableFields: ["status"] });
		assert.throws(() => qb.filter("status", "regex", "test"), /not supported/);
	});
});

describe("QueryBuilder - Search", () => {
	test("creates OR condition across search fields", () => {
		const qb = new QueryBuilder({
			searchFields: ["title", "content"],
		});

		qb.search("hello world");
		const where = qb.toWhere();

		assert.deepStrictEqual(where, {
			OR: [
				{ title: { contains: "hello world", mode: "insensitive" } },
				{ content: { contains: "hello world", mode: "insensitive" } },
			],
		});
	});

	test("combines search with filters", () => {
		const qb = new QueryBuilder({
			searchFields: ["title"],
			filterableFields: ["status"],
		});

		qb.search("test").filter("status", "eq", "published");

		const where = qb.toWhere();
		assert.deepStrictEqual(where, {
			AND: [
				{ status: { equals: "published" } },
				{ OR: [{ title: { contains: "test", mode: "insensitive" } }] },
			],
		});
	});

	test("ignores empty search term", () => {
		const qb = new QueryBuilder({ searchFields: ["title"] });
		qb.search("");

		assert.deepStrictEqual(qb.toWhere(), {});
	});

	test("trims search term", () => {
		const qb = new QueryBuilder({ searchFields: ["title"] });
		qb.search("  test  ");

		const where = qb.toWhere();
		assert.ok(where.OR[0].title.contains === "test");
	});

	test("throws when no search fields configured", () => {
		const qb = new QueryBuilder({ searchFields: [] });
		assert.throws(() => qb.search("test"), /No search fields/);
	});
});

describe("QueryBuilder - Sort", () => {
	test("creates orderBy clause with asc", () => {
		const qb = new QueryBuilder({ sortableFields: ["createdAt"] });
		qb.sort("createdAt", "asc");

		assert.deepStrictEqual(qb.toOrderBy(), { createdAt: "asc" });
	});

	test("creates orderBy clause with desc", () => {
		const qb = new QueryBuilder({ sortableFields: ["title"] });
		qb.sort("title", "desc");

		assert.deepStrictEqual(qb.toOrderBy(), { title: "desc" });
	});

	test("defaults to asc when direction not specified", () => {
		const qb = new QueryBuilder({ sortableFields: ["createdAt"] });
		qb.sort("createdAt");

		assert.deepStrictEqual(qb.toOrderBy(), { createdAt: "asc" });
	});

	test("returns undefined when no sort specified", () => {
		const qb = new QueryBuilder({ sortableFields: ["createdAt"] });
		assert.strictEqual(qb.toOrderBy(), undefined);
	});

	test("throws on non-sortable field", () => {
		const qb = new QueryBuilder({ sortableFields: ["createdAt"] });
		assert.throws(() => qb.sort("password"), /not sortable/);
	});

	test("throws on invalid direction", () => {
		const qb = new QueryBuilder({ sortableFields: ["createdAt"] });
		assert.throws(
			() => qb.sort("createdAt", "random"),
			/must be "asc" or "desc"/,
		);
	});
});

describe("QueryBuilder - Integration", () => {
	test("combines filter, search, and sort", () => {
		const qb = new QueryBuilder({
			filterableFields: ["status", "authorId"],
			searchFields: ["title", "content"],
			sortableFields: ["createdAt", "title"],
		});

		qb.filter("status", "eq", "published")
			.search("typescript")
			.sort("createdAt", "desc");

		const where = qb.toWhere();
		const orderBy = qb.toOrderBy();

		assert.deepStrictEqual(where, {
			AND: [
				{ status: { equals: "published" } },
				{
					OR: [
						{ title: { contains: "typescript", mode: "insensitive" } },
						{ content: { contains: "typescript", mode: "insensitive" } },
					],
				},
			],
		});

		assert.deepStrictEqual(orderBy, { createdAt: "desc" });
	});

	test("reset clears all conditions", () => {
		const qb = new QueryBuilder({
			filterableFields: ["status"],
			searchFields: ["title"],
			sortableFields: ["createdAt"],
		});

		qb.filter("status", "eq", "published")
			.search("test")
			.sort("createdAt", "desc");

		qb.reset();

		assert.deepStrictEqual(qb.toWhere(), {});
		assert.strictEqual(qb.toOrderBy(), undefined);
	});

	test("empty query builder returns empty where", () => {
		const qb = new QueryBuilder({
			filterableFields: ["status"],
			searchFields: ["title"],
			sortableFields: ["createdAt"],
		});

		assert.deepStrictEqual(qb.toWhere(), {});
		assert.strictEqual(qb.toOrderBy(), undefined);
	});
});

describe("QueryBuilder - Factory", () => {
	test("createQueryBuilder returns QueryBuilder instance", () => {
		const qb = createQueryBuilder({ filterableFields: ["status"] });
		assert.ok(qb instanceof QueryBuilder);
	});
});
