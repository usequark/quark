import { ForbiddenError, UnauthorizedError } from "@techstream/quark-core";
import { auth } from "./auth";

export async function requireAuth() {
	const session = await auth();

	if (!session) {
		throw new UnauthorizedError(
			"You must be logged in to access this resource",
		);
	}

	return session;
}

/**
 * Require the current user to have one of the specified roles.
 * @param {string | string[]} role - Required role(s) (e.g. "admin" or ["admin", "editor"])
 * @returns {Promise<import("next-auth").Session>}
 */
export async function requireRole(role) {
	const session = await requireAuth();

	const allowed = Array.isArray(role) ? role : [role];
	if (!allowed.includes(session.user?.role)) {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	}

	return session;
}
