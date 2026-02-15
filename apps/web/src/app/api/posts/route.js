import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { post, postCreateSchema } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const { page, limit } = paginationSchema.parse({
			page: searchParams.get("page") ?? undefined,
			limit: searchParams.get("limit") ?? undefined,
		});
		const skip = (page - 1) * limit;

		const posts = await post.findAll({ skip, take: limit });
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
