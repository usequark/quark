import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const updateBookingSchema = z.object({
	service: z.string().min(1).optional(),
	startTime: z.coerce.date().optional(),
	endTime: z.coerce.date().optional(),
	status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
	notes: z.string().optional(),
});

export async function GET(_request, { params }) {
	try {
		await requireRole(["admin", "editor", "viewer"]);
		const { id } = await params;
		const booking = await prisma.booking.findUnique({ where: { id } });
		if (!booking) {
			return NextResponse.json({ message: "Booking not found" }, { status: 404 });
		}
		return NextResponse.json(booking);
	} catch (error) {
		return handleError(error);
	}
}

export const PATCH = withCsrfProtection(async (request, { params }) => {
	try {
		await requireRole(["admin", "editor"]);
		const { id } = await params;
		const existing = await prisma.booking.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ message: "Booking not found" }, { status: 404 });
		}
		const data = await validateBody(request, updateBookingSchema);
		const booking = await prisma.booking.update({ where: { id }, data });
		return NextResponse.json(booking);
	} catch (error) {
		return handleError(error);
	}
});

export const DELETE = withCsrfProtection(async (_request, { params }) => {
	try {
		await requireRole(["admin"]);
		const { id } = await params;
		const existing = await prisma.booking.findUnique({ where: { id } });
		if (!existing) {
			return NextResponse.json({ message: "Booking not found" }, { status: 404 });
		}
		await prisma.booking.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
});
