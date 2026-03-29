import {
	parsePaginationQuery,
	validateBody,
	withCsrfProtection,
} from "@techstream/quark-core";
import { user, userCreateSchema } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

export async function GET(request) {
	try {
		await requireRole("admin");
		const { searchParams } = new URL(request.url);
		const { skip, take, meta } = parsePaginationQuery(searchParams);
		const [users, total] = await Promise.all([
			user.findAll({ skip, take }),
			user.count(),
		]);
		return NextResponse.json({ data: users, pagination: meta(total) });
	} catch (error) {
		return handleError(error);
	}
}

export const POST = withCsrfProtection(async (request) => {
	try {
		await requireRole("admin");
		const data = await validateBody(request, userCreateSchema);

		// Check if email already exists
		const existing = await user.findByEmail(data.email);
		if (existing) {
			return NextResponse.json(
				{ message: "User with this email already exists" },
				{ status: 409 },
			);
		}

		const newUser = await user.create(data);
		return NextResponse.json(newUser, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
});
