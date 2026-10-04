/**
 * @usequark/quark-core - CSRF Protection Module
 * Provides CSRF token generation and validation for API routes
 */

import crypto from "node:crypto";
import { UnauthorizedError } from "./errors.js";

/**
 * Generates a cryptographically secure CSRF token
 * @returns {string} CSRF token
 */
export function generateCsrfToken() {
	return crypto.randomBytes(32).toString("base64");
}

/**
 * Validates CSRF token from request headers
 * @param {Request} request - Next.js Request object
 * @param {string} sessionToken - Expected CSRF token from session/cookie
 * @throws {UnauthorizedError} If CSRF token is missing or invalid
 * @returns {boolean} True if valid
 */
export function validateCsrfToken(request, sessionToken) {
	const headerToken =
		request.headers.get("x-csrf-token") || request.headers.get("csrf-token");

	if (!headerToken) {
		throw new UnauthorizedError("CSRF token missing");
	}

	if (!sessionToken) {
		throw new UnauthorizedError("No CSRF token in session");
	}

	// Constant-time comparison to prevent timing attacks
	const headerBuf = Buffer.from(headerToken);
	const sessionBuf = Buffer.from(sessionToken);

	if (
		headerBuf.length !== sessionBuf.length ||
		!crypto.timingSafeEqual(headerBuf, sessionBuf)
	) {
		throw new UnauthorizedError("Invalid CSRF token");
	}

	return true;
}

/**
 * Middleware to require CSRF token for state-changing methods.
 *
 * Validation flow:
 *   1. Read the expected token from the `csrf_token` HTTP-only cookie
 *      (set by the `/api/csrf` endpoint).
 *   2. Compare it against the `X-CSRF-Token` (or `CSRF-Token`) request header
 *      that the client attaches to every mutating request.
 *
 * NextAuth already handles CSRF for /api/auth/* routes, so those are skipped.
 *
 * @param {Request} request - Next.js Request object
 * @returns {void}
 * @throws {UnauthorizedError} If CSRF validation fails
 */
export function requireCsrfToken(request) {
	const method = request.method;
	const path = new URL(request.url).pathname;

	// Skip CSRF check for:
	// - Safe methods (GET, HEAD, OPTIONS)
	// - NextAuth routes (they have their own CSRF protection)
	// - Bearer-authenticated requests (e.g. mobile app) - CSRF exploits ambient
	//   cookie credentials; an Authorization header is not sent automatically
	//   by browsers, so cross-site forgery is not possible.
	if (
		["GET", "HEAD", "OPTIONS"].includes(method) ||
		path.startsWith("/api/auth/") ||
		request.headers.get("authorization")?.startsWith("Bearer ")
	) {
		return;
	}

	// Read the expected token from the HTTP-only cookie
	const cookieHeader = request.headers.get("cookie") || "";
	const cookieToken = parseCookieValue(cookieHeader, "csrf_token");

	if (!cookieToken) {
		throw new UnauthorizedError(
			"CSRF token not found - call GET /api/csrf first",
		);
	}

	validateCsrfToken(request, cookieToken);
}

/**
 * Creates a CSRF-protected API route handler.
 * Wraps your handler and automatically validates CSRF tokens.
 * @param {Function} handler - Your API route handler
 * @returns {Function} Wrapped handler with CSRF protection
 */
export function withCsrfProtection(handler) {
	return async (request, ...args) => {
		requireCsrfToken(request);
		return handler(request, ...args);
	};
}

/**
 * Parse a single cookie value from a raw Cookie header string.
 * @param {string} cookieHeader - Raw `Cookie` header value
 * @param {string} name - Cookie name to look up
 * @returns {string|undefined}
 */
function parseCookieValue(cookieHeader, name) {
	const match = cookieHeader
		.split(";")
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`));

	return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
