/**
 * Content-specific query helpers that extend the admin's generic CRUD layer.
 *
 * These are thin wrappers around `updateRecord` / `findMany` etc. that add
 * content-lifecycle semantics (publish, archive, unpublish) and slug-based
 * lookup for use in public-facing Server Components.
 */

import { findMany, updateRecord } from "@techstream/quark-admin";
import { AppError } from "@techstream/quark-core";
import { getDelegate } from "./prisma-delegate.js";
import { applyTransition, canTransition } from "./status.js";

/**
 * Publish a content record.
 * Sets status to PUBLISHED and publishedAt to now (if not already set).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {"Page" | "Post"} model
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function publishContent(prisma, model, id) {
	const record = await getRecord(prisma, model, id);
	if (!canTransition(record.status, "PUBLISHED")) {
		throw new AppError(
			`Cannot publish a ${model} with status ${record.status}`,
			400,
			"INVALID_TRANSITION",
		);
	}
	const patch = applyTransition(record, "PUBLISHED");
	return updateRecord(prisma, model, id, patch);
}

/**
 * Archive a content record.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {"Page" | "Post"} model
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function archiveContent(prisma, model, id) {
	const record = await getRecord(prisma, model, id);
	if (!canTransition(record.status, "ARCHIVED")) {
		throw new AppError(
			`Cannot archive a ${model} with status ${record.status}`,
			400,
			"INVALID_TRANSITION",
		);
	}
	const patch = applyTransition(record, "ARCHIVED");
	return updateRecord(prisma, model, id, patch);
}

/**
 * Revert a content record to draft.
 * Clears publishedAt.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {"Page" | "Post"} model
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function unpublishContent(prisma, model, id) {
	const record = await getRecord(prisma, model, id);
	if (!canTransition(record.status, "DRAFT")) {
		throw new AppError(
			`Cannot revert a ${model} with status ${record.status} to draft`,
			400,
			"INVALID_TRANSITION",
		);
	}
	const patch = applyTransition(record, "DRAFT");
	return updateRecord(prisma, model, id, patch);
}

/**
 * Find a single published content record by slug.
 * Returns null if not found or not published.
 * Use this in public-facing Server Components.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {"Page" | "Post"} model
 * @param {string} slug
 * @returns {Promise<object | null>}
 */
export async function findBySlug(prisma, model, slug) {
	const delegate = getDelegate(prisma, model);
	return delegate.findUnique({ where: { slug, status: "PUBLISHED" } });
}

/**
 * List content filtered by status, ordered by publishedAt desc then updatedAt desc.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {"Page" | "Post"} model
 * @param {{ status?: string, skip?: number, take?: number }} [options]
 * @returns {Promise<{ records: object[], total: number, skip: number, take: number }>}
 */
export async function findContent(prisma, model, options = {}) {
	const { status, skip = 0, take = 25 } = options;
	const where = status ? { status } : undefined;
	return findMany(prisma, model, {
		skip,
		take,
		where,
		orderBy: { updatedAt: "desc" },
	});
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function getRecord(prisma, model, id) {
	const delegate = getDelegate(prisma, model);
	const record = await delegate.findUnique({ where: { id } });
	if (!record) {
		throw new AppError(`${model} not found`, 404, "NOT_FOUND");
	}
	return record;
}
