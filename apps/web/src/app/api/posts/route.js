import { validateBody } from "@Bobnoddle/quark-core";
import { post, postCreateSchema } from "@Bobnoddle/quark-db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1", 10);
		const limit = parseInt(searchParams.get("limit") || "10", 10);
		const skip = (page - 1) * limit;

		const posts = await post.findAll({ skip, take: limit });
		return NextResponse.json(posts);
	} catch (error) {
		return handleError(error);
	}
}

export async function POST(request) {
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
}
