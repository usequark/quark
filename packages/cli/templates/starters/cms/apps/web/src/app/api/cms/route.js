import { parsePaginationQuery, validateBody, withCsrfProtection } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

const createPageSchema = z.object({
	title: z.string().min(1),
	slug: z.string().min(1),
	body: z.string(),
	excerpt: z.string().optional(),
	status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

export async function GET(request) {
	try {
		await requireRole(["admin", "editor", "viewer"]);
		const { searchParams } = new URL(request.url);
		const { skip, take, meta } = parsePaginationQuery(searchParams);
		const [pages, total] = await Promise.all([
			prisma.page.findMany({
				orderBy: { updatedAt: "desc" },
				skip,
				take,
				include: { author: { select: { id: true, name: true, email: true } } },
			}),
			prisma.page.count(),
		]);
		return NextResponse.json({ data: pages, pagination: meta(total) });
	} catch (error) {
		return handleError(error);
	}
}

export const POST = withCsrfProtection(async (request) => {
	try {
		const session = await requireRole(["admin", "editor"]);
		const data = await validateBody(request, createPageSchema);
		const page = await prisma.page.create({
			data: {
				title: data.title,
				slug: data.slug,
				body: data.body,
				excerpt: data.excerpt,
				status: data.status,
				publishedAt: data.status === "PUBLISHED" ? new Date() : null,
				authorId: session.user?.id,
			},
		});
		return NextResponse.json(page, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
});
