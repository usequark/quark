import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { user, userUpdateSchema } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

export async function GET(_request, { params }) {
	try {
		await requireRole("admin");
		const { id } = await params;
		const foundUser = await user.findById(id);
		if (!foundUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}
		return NextResponse.json(foundUser);
	} catch (error) {
		return handleError(error);
	}
}

export const PATCH = withCsrfProtection(async (request, { params }) => {
	try {
		await requireRole("admin");
		const { id } = await params;

		const existingUser = await user.findById(id);
		if (!existingUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		const data = await validateBody(request, userUpdateSchema);
		const updatedUser = await user.update(id, data);
		return NextResponse.json(updatedUser);
	} catch (error) {
		return handleError(error);
	}
});

export const DELETE = withCsrfProtection(async (_request, { params }) => {
	try {
		await requireRole("admin");
		const { id } = await params;

		const existingUser = await user.findById(id);
		if (!existingUser) {
			return NextResponse.json({ message: "User not found" }, { status: 404 });
		}

		await user.delete(id);
		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
});
