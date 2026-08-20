import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const updateDealSchema = z.object({
	title: z.string().min(1).optional(),
	value: z.coerce.number().min(0).optional(),
	stage: z.string().optional(),
	contactId: z.string().nullable().optional(),
	companyId: z.string().nullable().optional(),
});

export async function GET(_request, { params }) {
	try {
		await requireRole(["admin", "editor", "viewer"]);
		const { id } = await params;
		const deal = await prisma.deal.findUnique({
			where: { id },
			include: {
				contact: { select: { id: true, firstName: true, lastName: true } },
				company: { select: { id: true, name: true } },
			},
		});
		if (!deal) {
			return NextResponse.json({ message: "Deal not found" }, { status: 404 });
		}
		return NextResponse.json(deal);
	} catch (error) {
		return handleError(error);
	}
}

export const PATCH = withCsrfProtection(async (request, { params }) => {
	try {
		await requireRole(["admin", "editor"]);
		const { id } = await params;
		const existing = await prisma.deal.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ message: "Deal not found" }, { status: 404 });
		}
		const data = await validateBody(request, updateDealSchema);
		const deal = await prisma.deal.update({ where: { id }, data });
		return NextResponse.json(deal);
	} catch (error) {
		return handleError(error);
	}
});

export const DELETE = withCsrfProtection(async (_request, { params }) => {
	try {
		await requireRole(["admin"]);
		const { id } = await params;
		const existing = await prisma.deal.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ message: "Deal not found" }, { status: 404 });
		}
		await prisma.deal.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
});
