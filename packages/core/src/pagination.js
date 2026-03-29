/**
 * @techstream/quark-core - Pagination Utilities
 *
 * Provides offset-based pagination helpers that integrate with Prisma's
 * skip/take API and the project's ValidationError convention.
 *
 * Usage in a route handler:
 *
 *   import { parsePaginationQuery } from "@techstream/quark-core";
 *
 *   export async function GET(request) {
 *     const { searchParams } = new URL(request.url);
 *     const { skip, take, meta } = parsePaginationQuery(searchParams);
 *     const [records, total] = await Promise.all([
 *       prisma.post.findMany({ skip, take }),
 *       prisma.post.count(),
 *     ]);
 *     return NextResponse.json({ data: records, pagination: meta(total) });
 *   }
 */

import { z } from "zod";
import { ValidationError } from "./errors.js";

/** Default maximum page size. Can be overridden per-call via options. */
const DEFAULT_MAX_LIMIT = 100;

/** Default page size when ?limit is not provided. */
const DEFAULT_LIMIT = 20;

/**
 * Build a Zod schema for pagination query params.
 * @param {number} maxLimit
 * @returns {import("zod").ZodObject<any>}
 */
function buildSchema(maxLimit) {
	return z.object({
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(maxLimit).default(DEFAULT_LIMIT),
	});
}

/**
 * Parse and validate raw pagination params from a URL search params object,
 * a plain key/value object, or any iterable of [key, value] pairs.
 *
 * Throws ValidationError on invalid input so the existing `handleError`
 * in route handlers catches it and returns a 422 automatically.
 *
 * @param {URLSearchParams | Record<string, string | undefined> | Iterable<[string, string]>} params
 * @param {{ maxLimit?: number }} [options]
 * @returns {{ page: number, limit: number }}
 */
export function parsePagination(params, options = {}) {
	const maxLimit = options.maxLimit ?? DEFAULT_MAX_LIMIT;
	const schema = buildSchema(maxLimit);

	// Normalise to a plain object regardless of input type
	let raw;
	if (params instanceof URLSearchParams) {
		raw = { page: params.get("page"), limit: params.get("limit") };
	} else if (
		typeof params === "object" &&
		params !== null &&
		typeof params[Symbol.iterator] === "function"
	) {
		raw = Object.fromEntries(params);
	} else {
		raw = params ?? {};
	}

	// Strip null/undefined keys so Zod defaults kick in
	const cleaned = Object.fromEntries(
		Object.entries(raw).filter(([, v]) => v != null),
	);

	const result = schema.safeParse(cleaned);
	if (!result.success) {
		throw new ValidationError(result.error.flatten());
	}
	return result.data;
}

/**
 * Convert page + limit into Prisma's skip/take arguments.
 *
 * @param {{ page: number, limit: number }} pagination
 * @returns {{ skip: number, take: number }}
 */
export function paginationToSkip({ page, limit }) {
	return {
		skip: (page - 1) * limit,
		take: limit,
	};
}

/**
 * Build the pagination metadata envelope returned in API responses.
 *
 * @param {{ page: number, limit: number, total: number }} params
 * @returns {{ total: number, page: number, limit: number, totalPages: number, hasNext: boolean, hasPrev: boolean }}
 */
export function paginationMeta({ page, limit, total }) {
	const totalPages = Math.ceil(total / limit);
	return {
		total,
		page,
		limit,
		totalPages,
		hasNext: page < totalPages,
		hasPrev: page > 1,
	};
}

/**
 * Convenience helper that parses pagination params and returns everything
 * needed to call Prisma + build the response envelope in one shot.
 *
 * @param {URLSearchParams | Record<string, string | undefined>} params
 * @param {{ maxLimit?: number }} [options]
 * @returns {{
 *   page: number,
 *   limit: number,
 *   skip: number,
 *   take: number,
 *   meta: (total: number) => ReturnType<typeof paginationMeta>
 * }}
 */
export function parsePaginationQuery(params, options = {}) {
	const { page, limit } = parsePagination(params, options);
	const { skip, take } = paginationToSkip({ page, limit });
	return {
		page,
		limit,
		skip,
		take,
		meta: (total) => paginationMeta({ page, limit, total }),
	};
}
