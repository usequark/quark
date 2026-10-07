import {
	ConflictError,
	validateBody,
	withCsrfProtection,
} from "@usequark/quark-core";
import { user, userUpdateSchema } from "@usequark/quark-db";
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

/**
 * DELETE /api/users/[id]
 * Delete a user. Admin only.
 *
 * Self-deletion is refused. The route resolves its target purely from the path
 * segment and otherwise only checks the caller's role, so an admin could delete
 * their own row — and if they were the last admin, leave the deployment with no
 * way to administer it. Refusing here rather than warning is deliberate: the
 * request cannot succeed without leaving either the caller or the deployment
 * locked out, so there is no outcome the caller would want.
 *
 * This guard is per-request, not a check on the remaining admin count. Two
 * concurrent deletes of the two last admins can still both pass it. Enforcing
 * that invariant needs a transaction around the count and the delete, which is a
 * larger change than this endpoint's current shape supports.
 */
export const DELETE = withCsrfProtection(async (_request, { params }) => {
	try {
		const session = await requireRole("admin");
		const { id } = await params;

		if (session?.user?.id === id) {
			throw new ConflictError(
				"You cannot delete the account you are signed in as",
			);
		}

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
