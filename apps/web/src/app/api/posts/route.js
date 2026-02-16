import {
	createQueryBuilder,
	validateBody,
	withCsrfProtection,
} from "@techstream/quark-core";
import { post, postCreateSchema } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
});

const querySchema = paginationSchema.extend({
	search: z.string().optional(),
	status: z.enum(["draft", "published"]).optional(),
	authorId: z.string().optional(),
	sort: z.enum(["createdAt", "updatedAt", "title"]).optional(),
	order: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const { page, limit, search, status, authorId, sort, order } =
			querySchema.parse({
				page: searchParams.get("page") ?? undefined,
				limit: searchParams.get("limit") ?? undefined,
				search: searchParams.get("search") ?? undefined,
				status: searchParams.get("status") ?? undefined,
				authorId: searchParams.get("authorId") ?? undefined,
				sort: searchParams.get("sort") ?? undefined,
				order: searchParams.get("order") ?? undefined,
			});

		const skip = (page - 1) * limit;

		// Build query with filters, search, and sort
		const qb = createQueryBuilder({
			filterableFields: ["published", "authorId"],
			searchFields: ["title", "content"],
			sortableFields: ["createdAt", "updatedAt", "title"],
		});

		// Apply filters
		if (status === "published") {
			qb.filter("published", "eq", true);
		} else if (status === "draft") {
			qb.filter("published", "eq", false);
		}

		if (authorId) {
			qb.filter("authorId", "eq", authorId);
		}

		// Apply search
		if (search) {
			qb.search(search);
		}

		// Apply sort
		if (sort) {
			qb.sort(sort, order);
		}

		const posts = await post.findAll({
			skip,
			take: limit,
			where: qb.toWhere(),
			orderBy: qb.toOrderBy(),
		});

		return NextResponse.json(posts);
	} catch (error) {
		return handleError(error);
	}
}

export const POST = withCsrfProtection(async (request) => {
	try {
		const session = await requireAuth();
		const data = await validateBody(request, postCreateSchema);

		const newPost = await post.create({
			...data,
			authorId: session.user.id,
		});
		return NextResponse.json(newPost, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
});
