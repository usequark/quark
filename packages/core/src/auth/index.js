/**
 * @techstream/quark-core - Authentication Module
 * Provides next-auth initialization and session management helpers
 */

import { UnauthorizedError } from "../errors.js";
import { createLogger } from "../logger.js";

export * from "./password.js";

const logger = createLogger({ name: "auth" });

/**
 * Resolves the auth secret from the supported environment variables.
 * Prefers NEXTAUTH_SECRET for compatibility, but also accepts AUTH_SECRET.
 * @returns {string|null}
 */
export const getAuthSecret = () => {
	return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || null;
};

/**
 * Detects whether the app is running on a deployed (non-local) environment.
 * @returns {boolean}
 */
function isDeployed() {
	const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
	if (url && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url)) return true;
	return !!(
		process.env.VERCEL ||
		process.env.CF_PAGES ||
		process.env.RAILWAY_SERVICE_ID ||
		process.env.AUTH_TRUST_HOST ||
		process.env.NODE_ENV !== "production"
	);
}

/**
 * Creates a next-auth configuration object with sensible defaults.
 * Designed to be extended by applications.
 * @param {Object} options - Configuration options
 * @param {Array} options.providers - Next-auth providers (GitHub, Google, etc.)
 * @param {Object} options.callbacks - next-auth callbacks (jwt, session, etc.)
 * @param {Object} options.session - Session configuration
 * @param {string} options.secret - NEXTAUTH_SECRET (defaults to env var)
 * @param {string} options.trustHost - When false, next-auth rejects requests from unknown hosts
 * @returns {Object} Complete next-auth configuration
 */
export const createAuthConfig = (options = {}) => {
	const {
		providers = [],
		callbacks = {},
		session = {},
		secret = getAuthSecret(),
		...rest
	} = options;

	if (!secret) {
		throw new Error(
			"NEXTAUTH_SECRET or AUTH_SECRET must be set (env var or options.secret)",
		);
	}

	const trustHost = rest.trustHost ?? isDeployed();

	return {
		secret,
		providers,
		session: {
			strategy: "jwt",
			maxAge: 30 * 24 * 60 * 60, // 30 days
			updateAge: 24 * 60 * 60, // 24 hours
			...session,
		},
		callbacks: {
			async jwt({ token, user }) {
				if (user) {
					token.id = user.id;
					token.email = user.email;
					token.name = user.name;
					token.role = user.role || "viewer";
				}
				return token;
			},
			async session({ session, token }) {
				if (session.user) {
					session.user.id = token.id;
					session.user.role = token.role;
				}
				return session;
			},
			...callbacks,
		},
		pages: {
			signIn: "/auth/signin",
			error: "/auth/error",
		},
		trustHost,
		...rest,
	};
};

/**
 * Utility to safely get the current session (works in both server & edge)
 * @param {Function} getSession - The next-auth getSession function
 * @returns {Promise<Object|null>} Session object or null if not authenticated
 */
export const getCurrentSession = async (getSession) => {
	try {
		return await getSession();
	} catch (error) {
		logger.error("Failed to get session", {
			message: error?.message ?? String(error),
		});
		return null;
	}
};

/**
 * Checks if a user is authenticated
 * @param {Object} session - Session object from next-auth
 * @returns {boolean} True if user is authenticated
 */
export const isAuthenticated = (session) => {
	return session?.user?.email;
};

/**
 * Gets user ID from session
 * @param {Object} session - Session object from next-auth
 * @returns {string|null} User ID or null
 */
export const getUserId = (session) => {
	return session?.user?.id || null;
};

/**
 * Gets user email from session
 * @param {Object} session - Session object from next-auth
 * @returns {string|null} User email or null
 */
export const getUserEmail = (session) => {
	return session?.user?.email || null;
};

/**
 * Validates that a request has a valid session
 * Throws UnauthorizedError if not authenticated
 * @param {Object} session - Session object from next-auth
 * @throws {UnauthorizedError} If session is invalid
 * @returns {string} User ID
 */
export const requireAuth = (session) => {
	const userId = getUserId(session);
	if (!userId) {
		throw new UnauthorizedError("Authentication required");
	}
	return userId;
};
