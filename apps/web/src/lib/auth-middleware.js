import { ForbiddenError, UnauthorizedError } from "@techstream/quark-core";
import { auth } from "./auth";

const UNAUTHENTICATED = "You must be logged in to access this resource";

/**
 * Whether `value` is a session that identifies a real, signed-in user.
 *
 * Truthiness is not enough. `@auth/core` answers a misconfigured provider with
 * a 500, and a client that returns the error body as though it were a session
 * would sail through `if (!session)`. That is not hypothetical: it is exactly
 * what next-auth 5.0.0-beta.31 did, which is why beta.32 added
 * `parseSessionResponse`. An error object is truthy, so the old guard treated a
 * server-side misconfiguration as an authenticated request and handed callers a
 * session with `user === undefined`.
 *
 * beta.32 fixes the source, but the defence belongs here too: a guard that
 * depends on a pre-release library behaving correctly is one beta bump away from
 * failing open again. Requiring a user with an `id` means an error body, a
 * partially-populated session, or a `{}` all fail closed regardless of what the
 * client returns.
 *
 * @param {unknown} value
 * @returns {value is import("next-auth").Session}
 */
function isAuthenticatedSession(value) {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const sessionUser = /** @type {{ user?: unknown }} */ (value).user;
	if (typeof sessionUser !== "object" || sessionUser === null) {
		return false;
	}

	const id = /** @type {{ id?: unknown, sub?: unknown }} */ (sessionUser).id;
	const subject = /** @type {{ id?: unknown, sub?: unknown }} */ (sessionUser)
		.sub;

	return (
		(typeof id === "string" && id.length > 0) ||
		(typeof subject === "string" && subject.length > 0)
	);
}

/**
 * Assert that a session identifies a real, signed-in user, or throw.
 *
 * @param {unknown} session
 * @returns {Promise<import("next-auth").Session>}
 */
export async function requireAuth(session) {
	if (session === undefined) {
		session = await auth();
	}

	if (!isAuthenticatedSession(session)) {
		throw new UnauthorizedError(UNAUTHENTICATED);
	}

	return session;
}

/**
 * Require the current user to have one of the specified roles.
 *
 * @param {string | string[]} role - Required role(s) (e.g. "admin" or ["admin", "editor"])
 * @param {unknown} [session] - Injectable for tests; read from `auth()` when omitted.
 * @returns {Promise<import("next-auth").Session>}
 */
export async function requireRole(role, session) {
	const authenticated = await requireAuth(session);

	const allowed = Array.isArray(role) ? role : [role];
	if (!allowed.includes(authenticated.user?.role)) {
		throw new ForbiddenError(
			"You do not have permission to access this resource",
		);
	}

	return authenticated;
}
