import { parsePaginationQuery, validateBody, withCsrfProtection } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

const createBookingSchema = z.object({
	service: z.string().min(1),
	startTime: z.coerce.date(),
	endTime: z.coerce.date(),
	notes: z.string().optional(),
});

export async function GET(request) {
	try {
		await requireRole(["admin", "editor", "viewer"]);
		const { searchParams } = new URL(request.url);
		const { skip, take, meta } = parsePaginationQuery(searchParams);
		const [bookings, total] = await Promise.all([
			prisma.booking.findMany({
				orderBy: { startTime: "desc" },
				skip,
				take,
			}),
			prisma.booking.count(),
		]);
		return NextResponse.json({ data: bookings, pagination: meta(total) });
	} catch (error) {
		return handleError(error);
	}
}

export const POST = withCsrfProtection(async (request) => {
	try {
		await requireRole(["admin", "editor"]);
		const data = await validateBody(request, createBookingSchema);
		const booking = await prisma.booking.create({ data });
		return NextResponse.json(booking, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
});
