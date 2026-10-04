/**
 * @usequark/quark-core - Auth Middleware
 *
 * Lightweight, framework-agnostic authentication middleware for Server
 * Actions and API routes.  The caller supplies a `getSession` function
 * (e.g. NextAuth's `auth()`) — this module adds the guard logic.
 *
 * Usage:
 *   import { requireSession, requireSessionRole, createAuthMiddleware } from "@usequark/quark-core/auth/middleware";
 *
 *   // In a Server Action:
 *   const session = await requireSession(() => auth());
 *   // session is guaranteed non-null; UnauthorizedError thrown otherwise.
 */

import { ForbiddenError, UnauthorizedError } from "../errors.js";

/**
 * Requires a valid session.  Throws `UnauthorizedError` if the session
 * is missing or has no user.
 *
 * @template T
 * @param {() => Promise<T | null>} getSession - Async function that returns the session (or null)
 * @returns {Promise<T>} The session, guaranteed non-null
 * @throws {UnauthorizedError}
 */
export async function requireSession(getSession) {
	const session = await getSession();
	if (!session) {
		throw new UnauthorizedError("Authentication required");
	}
	return session;
}

/**
 * Requires a valid session **and** that the user has the specified role.
 *
 * @template {{ user?: { role?: string } | null }} S
 * @param {string} role - Required role (case-insensitive comparison)
 * @param {() => Promise<S | null>} getSession - Async function that returns the session (or null)
 * @returns {Promise<S>} The session, guaranteed non-null with the correct role
 * @throws {UnauthorizedError} When the session is missing
 * @throws {ForbiddenError}   When the user's role does not match
 */
export async function requireSessionRole(role, getSession) {
	const session = await requireSession(getSession);
	const userRole = session?.user?.role;

	if (!userRole || userRole.toLowerCase() !== role.toLowerCase()) {
		throw new ForbiddenError(
			`Role "${role}" required — you have "${userRole || "none"}"`,
		);
	}

	return session;
}

/**
 * Creates a reusable auth middleware from a configuration object.
 *
 * @param {Object} options
 * @param {() => Promise<any | null>} options.getSession - Async function returning the session
 * @param {string} [options.roleField="role"] - Field on `session.user` that holds the role
 * @returns {{
 *   requireSession: () => Promise<any>,
 *   requireSessionRole: (role: string) => Promise<any>
 * }}
 */
export function createAuthMiddleware({ getSession, roleField = "role" }) {
	/**
	 * @returns {Promise<any>} The session
	 */
	async function resolveSession() {
		const session = await getSession();
		if (!session) {
			throw new UnauthorizedError("Authentication required");
		}
		return session;
	}

	return {
		/**
		 * @returns {Promise<any>} The session
		 */
		async requireSession() {
			return resolveSession();
		},

		/**
		 * @param {string} role - Required role
		 * @returns {Promise<any>} The session
		 */
		async requireSessionRole(role) {
			const session = await resolveSession();
			const userRole = session?.user?.[roleField];

			if (!userRole || userRole.toLowerCase() !== role.toLowerCase()) {
				throw new ForbiddenError(
					`Role "${role}" required — you have "${userRole || "none"}"`,
				);
			}

			return session;
		},
	};
}
