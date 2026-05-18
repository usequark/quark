import assert from "node:assert/strict";
import { test } from "node:test";

// Mock @techstream/quark-admin before importing content-query
// node:test mock.module is not available in all Node versions, so we use
// conditional imports and a manual mock approach via dependency injection.
// The functions under test accept `prisma` as first arg, so we can exercise
// them without mocking the module import — but publishContent/archiveContent/
// unpublishContent call `updateRecord` from quark-admin internally.
// We test those via integration-style mocks of the prisma delegate.

// Import the module. @techstream/quark-admin must be resolvable.
import {
	archiveContent,
	findBySlug,
	publishContent,
	unpublishContent,
} from "./content-query.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePrisma(record) {
	const delegate = {
		findUnique: async ({ where: { id } }) => {
			if (!record) return null;
			if (id && id !== record.id) return null;
			return record;
		},
		findFirst: async ({ where: { slug, status } }) => {
			if (!record) return null;
			if (slug !== record.slug) return null;
			// Mirror the status filter applied by findBySlug
			if (status && record.status !== status) return null;
			return record;
		},
		update: async ({ data }) => ({ ...record, ...data }),
		count: async () => 1,
		findMany: async () => (record ? [record] : []),
	};
	return { page: delegate };
}

// ─── findBySlug ───────────────────────────────────────────────────────────────

test("findBySlug — returns record when slug matches", async () => {
	const page = { id: "1", slug: "about", status: "PUBLISHED" };
	const prisma = makePrisma(page);
	const result = await findBySlug(prisma, "Page", "about");
	assert.deepEqual(result, page);
});

test("findBySlug — returns null when no record exists", async () => {
	const prisma = makePrisma(null);
	const result = await findBySlug(prisma, "Page", "missing");
	assert.equal(result, null);
});

test("findBySlug — does NOT return draft records (public-only)", async () => {
	const draftPage = { id: "1", slug: "secret", status: "DRAFT" };
	const prisma = makePrisma(draftPage);
	const result = await findBySlug(prisma, "Page", "secret");
	assert.equal(result, null);
});

// ─── publishContent ───────────────────────────────────────────────────────────

test("publishContent — rejects when status is ARCHIVED (no ARCHIVED→PUBLISHED transition)", async () => {
	const record = { id: "1", status: "ARCHIVED", publishedAt: null };
	const prisma = makePrisma(record);
	await assert.rejects(
		() => publishContent(prisma, "Page", "1"),
		/Cannot publish/,
	);
});

test("publishContent — accepts DRAFT record", async () => {
	const record = { id: "1", status: "DRAFT", publishedAt: null };
	const prisma = makePrisma(record);
	// Should not throw
	const result = await publishContent(prisma, "Page", "1");
	assert.equal(result.status, "PUBLISHED");
});

// ─── archiveContent ───────────────────────────────────────────────────────────

test("archiveContent — rejects when status is DRAFT (no DRAFT→ARCHIVED transition)", async () => {
	const record = { id: "1", status: "DRAFT", publishedAt: null };
	const prisma = makePrisma(record);
	await assert.rejects(
		() => archiveContent(prisma, "Page", "1"),
		/Cannot archive/,
	);
});

test("archiveContent — accepts PUBLISHED record", async () => {
	const record = { id: "1", status: "PUBLISHED", publishedAt: new Date() };
	const prisma = makePrisma(record);
	const result = await archiveContent(prisma, "Page", "1");
	assert.equal(result.status, "ARCHIVED");
});

// ─── unpublishContent ─────────────────────────────────────────────────────────

test("unpublishContent — rejects when status is DRAFT (can't unpublish a draft)", async () => {
	const record = { id: "1", status: "DRAFT", publishedAt: null };
	const prisma = makePrisma(record);
	await assert.rejects(
		() => unpublishContent(prisma, "Page", "1"),
		/Cannot revert/,
	);
});

test("unpublishContent — accepts PUBLISHED record and clears publishedAt", async () => {
	const record = { id: "1", status: "PUBLISHED", publishedAt: new Date() };
	const prisma = makePrisma(record);
	const result = await unpublishContent(prisma, "Page", "1");
	assert.equal(result.status, "DRAFT");
	assert.equal(result.publishedAt, null);
});

// ─── Not found ────────────────────────────────────────────────────────────────

test("publishContent — throws when record not found", async () => {
	const prisma = makePrisma(null);
	await assert.rejects(
		() => publishContent(prisma, "Page", "nonexistent"),
		/not found/i,
	);
});
