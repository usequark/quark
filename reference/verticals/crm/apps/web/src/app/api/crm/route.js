import {
	parsePaginationQuery,
	validateBody,
	withCsrfProtection,
} from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

const createDealSchema = z.object({
	title: z.string().min(1),
	value: z.coerce.number().min(0).default(0),
	stage: z.string().default("LEAD"),
	contactId: z.string().optional(),
	companyId: z.string().optional(),
});

export async function GET(request) {
	try {
		await requireRole(["admin", "editor", "viewer"]);
		const { searchParams } = new URL(request.url);
		const { skip, take, meta } = parsePaginationQuery(searchParams);
		const [deals, total] = await Promise.all([
			prisma.deal.findMany({
				orderBy: { updatedAt: "desc" },
				skip,
				take,
				include: {
					contact: { select: { id: true, firstName: true, lastName: true } },
					company: { select: { id: true, name: true } },
				},
			}),
			prisma.deal.count(),
		]);
		return NextResponse.json({ data: deals, pagination: meta(total) });
	} catch (error) {
		return handleError(error);
	}
}

export const POST = withCsrfProtection(async (request) => {
	try {
		await requireRole(["admin", "editor"]);
		const data = await validateBody(request, createDealSchema);
		const deal = await prisma.deal.create({ data });
		return NextResponse.json(deal, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
});
