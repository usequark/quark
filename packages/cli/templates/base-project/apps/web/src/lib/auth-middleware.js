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
 * Require the current user to have a specific role.
 * @param {string} role - Required role (e.g. "admin")
 * @returns {Promise<import("next-auth").Session>}
 */
export async function requireRole(role) {
	const session = await requireAuth();

	if (session.user?.role !== role) {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	}

	return session;
}
