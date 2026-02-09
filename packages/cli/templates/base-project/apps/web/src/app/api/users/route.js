import { validateBody } from "@quark/core";
import { user, userCreateSchema } from "@quark/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../error-handler";

export async function GET(_request) {
	try {
		await requireAuth();
		const users = await user.findAll();
		return NextResponse.json(users);
	} catch (error) {
		return handleError(error);
	}
}

export async function POST(request) {
	try {
		await requireAuth();
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
}
