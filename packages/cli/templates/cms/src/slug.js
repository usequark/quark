/**
 * Slug utilities for CMS content.
 *
 * Generates URL-safe slugs from title strings and validates uniqueness
 * against the Prisma database, appending a numeric suffix when needed.
 */

/**
 * Generate a URL-safe slug from a title string.
 * Converts to lowercase, replaces spaces and non-alphanumeric chars with hyphens,
 * collapses multiple hyphens, and trims leading/trailing hyphens.
 *
 * @param {string} title
 * @returns {string}
 */
export function generateSlug(title) {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/[\s]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Ensure a slug is unique for the given Prisma model by appending -2, -3, etc.
 * when the base slug is already taken.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {"Page" | "Post"} model     - Prisma model name
 * @param {string}          slug      - Candidate slug
 * @param {string}          [excludeId] - Exclude this record ID (for updates)
 * @returns {Promise<string>}           - A unique slug
 */
import { getDelegate } from "./prisma-delegate.js";

export async function ensureUniqueSlug(prisma, model, slug, excludeId) {
	const delegate = getDelegate(prisma, model);

	let candidate = slug;
	let suffix = 2;

	while (true) {
		const _where = excludeId
			? { slug: candidate, NOT: { id: excludeId } }
			: { slug: candidate };

		const existing = await delegate.findUnique({ where: { slug: candidate } });

		if (!existing || (excludeId && existing.id === excludeId)) {
			return candidate;
		}

		candidate = `${slug}-${suffix}`;
		suffix++;
	}
}
