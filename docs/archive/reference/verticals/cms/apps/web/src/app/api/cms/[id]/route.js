import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const updatePageSchema = z.object({
	title: z.string().min(1).optional(),
	slug: z.string().min(1).optional(),
	body: z.string().optional(),
	excerpt: z.string().nullable().optional(),
	status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function GET(_request, { params }) {
	try {
		await requireRole(["admin", "editor", "viewer"]);
		const { id } = await params;
		const page = await prisma.page.findUnique({
			where: { id },
			include: { author: { select: { id: true, name: true, email: true } } },
		});
		if (!page) {
			return NextResponse.json({ message: "Page not found" }, { status: 404 });
		}
		return NextResponse.json(page);
	} catch (error) {
		return handleError(error);
	}
}

export const PATCH = withCsrfProtection(async (request, { params }) => {
	try {
		await requireRole(["admin", "editor"]);
		const { id } = await params;
		const existing = await prisma.page.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ message: "Page not found" }, { status: 404 });
		}
		const data = await validateBody(request, updatePageSchema);
		const page = await prisma.page.update({
			where: { id },
			data: {
				...data,
				publishedAt:
					data.status === "PUBLISHED" && existing.status !== "PUBLISHED"
						? new Date()
						: undefined,
			},
		});
		return NextResponse.json(page);
	} catch (error) {
		return handleError(error);
	}
});

export const DELETE = withCsrfProtection(async (_request, { params }) => {
	try {
		await requireRole(["admin"]);
		const { id } = await params;
		const existing = await prisma.page.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ message: "Page not found" }, { status: 404 });
		}
		await prisma.page.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
});
