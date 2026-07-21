import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureUniqueSlug, generateSlug } from "./slug.js";

// ─── generateSlug ─────────────────────────────────────────────────────────────

test("generateSlug - converts to lowercase", () => {
	assert.equal(generateSlug("Hello World"), "hello-world");
});

test("generateSlug - replaces spaces with hyphens", () => {
	assert.equal(generateSlug("foo bar baz"), "foo-bar-baz");
});

test("generateSlug - strips non-alphanumeric chars", () => {
	assert.equal(generateSlug("Hello, World!"), "hello-world");
});

test("generateSlug - collapses multiple hyphens", () => {
	assert.equal(generateSlug("foo   bar"), "foo-bar");
});

test("generateSlug - trims leading and trailing hyphens", () => {
	assert.equal(generateSlug("  --hello--  "), "hello");
});

test("generateSlug - handles empty string", () => {
	assert.equal(generateSlug(""), "");
});

test("generateSlug - handles all-special chars", () => {
	assert.equal(generateSlug("!!!"), "");
});

test("generateSlug - preserves existing hyphens in alphanumeric input", () => {
	assert.equal(generateSlug("my-cool-post"), "my-cool-post");
});

test("generateSlug - strips unicode / accented characters", () => {
	// Non-ASCII chars are stripped (not transliterated)
	const result = generateSlug("Héllo Wörld");
	assert.match(result, /^[a-z0-9-]*$/);
});

// ─── ensureUniqueSlug ─────────────────────────────────────────────────────────

/**
 * Build a mock prisma delegate that returns null for unknown slugs and
 * returns an object for any slug in the `taken` set.
 */
function mockPrisma(taken = new Set()) {
	const delegate = {
		findUnique: async ({ where: { slug } }) =>
			taken.has(slug) ? { id: `id-${slug}`, slug } : null,
	};
	return { page: delegate };
}

test("ensureUniqueSlug - returns slug as-is when not taken", async () => {
	const prisma = mockPrisma(new Set());
	const result = await ensureUniqueSlug(prisma, "Page", "hello-world");
	assert.equal(result, "hello-world");
});

test("ensureUniqueSlug - appends -2 when base slug is taken", async () => {
	const prisma = mockPrisma(new Set(["hello-world"]));
	const result = await ensureUniqueSlug(prisma, "Page", "hello-world");
	assert.equal(result, "hello-world-2");
});

test("ensureUniqueSlug - increments suffix until a free slot is found", async () => {
	const taken = new Set(["hello", "hello-2", "hello-3"]);
	const prisma = mockPrisma(taken);
	const result = await ensureUniqueSlug(prisma, "Page", "hello");
	assert.equal(result, "hello-4");
});

test("ensureUniqueSlug - excludeId: allows the same record to keep its slug", async () => {
	const existingId = "id-hello-world";
	// The delegate returns a record with that specific id for this slug
	const delegate = {
		findUnique: async ({ where: { slug } }) =>
			slug === "hello-world" ? { id: existingId, slug } : null,
	};
	const prisma = { page: delegate };
	const result = await ensureUniqueSlug(
		prisma,
		"Page",
		"hello-world",
		existingId,
	);
	assert.equal(result, "hello-world");
});

test("ensureUniqueSlug - throws on unknown model", async () => {
	const prisma = {};
	await assert.rejects(
		() => ensureUniqueSlug(prisma, "Unknown", "foo"),
		/Unknown Prisma model/,
	);
});
