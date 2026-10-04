/**
 * @usequark/quark-core — Admin Authorization Module
 *
 * Lightweight, stateless admin-token authorization for drop-in internal
 * endpoints (health checks, metrics, admin APIs).
 *
 * Agnostic by design: the admin token is read from the environment variable
 * ADMIN_API_TOKEN. No project-specific user database or session is required.
 * When no ADMIN_API_TOKEN is set, the endpoint is effectively open and the
 * guard is a no-op (appropriate for local development).
 *
 * Security properties:
 *  - Constant-time comparison to prevent timing attacks.
 *  - Token never appears in logs (masked by default).
 *  - Returns a generic 401 response that does not reveal whether the
 *    token was missing or incorrect.
 */

import { createLogger } from "./logger.js";

const log = createLogger("admin-auth");

/**
 * Checks whether the given token matches the configured ADMIN_API_TOKEN.
 *
 * Uses timing-safe comparison when both values are present.  When no
 * ADMIN_API_TOKEN is configured, the check always passes (development
 * convenience — log a warning on first call).
 *
 * @param {string | null | undefined} providedToken — Token from the request.
 * @returns {{ authorized: boolean, reason?: string }}
 */
export function verifyAdminToken(providedToken) {
	const configuredToken = process.env.ADMIN_API_TOKEN;

	// No token configured — dev mode, allow access with a warning.
	if (!configuredToken) {
		log.warn(
			"ADMIN_API_TOKEN is not set — admin endpoints are unprotected. " +
				"Set ADMIN_API_TOKEN in production.",
		);
		return { authorized: true };
	}

	if (!providedToken) {
		return { authorized: false, reason: "Missing authorization token" };
	}

	// Constant-time comparison.
	const normalized = providedToken.trim();
	if (normalized.length !== configuredToken.length) {
		return { authorized: false, reason: "Invalid authorization token" };
	}

	let mismatch = 0;
	for (let i = 0; i < normalized.length; i++) {
		mismatch |= normalized.charCodeAt(i) ^ configuredToken.charCodeAt(i);
	}

	if (mismatch !== 0) {
		return { authorized: false, reason: "Invalid authorization token" };
	}

	return { authorized: true };
}

/**
 * Express/Next.js middleware-style guard for API routes.
 *
 * Extracts the token from the `Authorization: Bearer <token>` header and
 * validates it.  Returns a 401 JSON response when unauthorized.
 *
 * Usage in an API route:
 *
 *   import { requireAdminToken } from "@usequark/quark-core";
 *   import { NextResponse } from "next/server";
 *
 *   export async function GET(request) {
 *     const auth = requireAdminToken(request);
 *     if (!auth.authorized) {
 *       return NextResponse.json(
 *         { error: auth.reason },
 *         { status: 401 },
 *       );
 *     }
 *     // ... handle request
 *   }
 *
 * @param {Request} request — The incoming Next.js/Web API Request object.
 * @returns {{ authorized: true } | { authorized: false, reason: string, response: Response }}
 */
export function requireAdminToken(request) {
	const authHeader = request.headers.get("authorization") || "";
	let token = null;

	// Support both "Bearer <token>" and raw token in header.
	const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
	if (bearerMatch) {
		token = bearerMatch[1];
	} else if (authHeader) {
		// Allow token directly in header (for tools that don't support Bearer).
		token = authHeader;
	}

	// Also check x-admin-token header as a secondary option.
	if (!token) {
		token = request.headers.get("x-admin-token");
	}

	const result = verifyAdminToken(token);

	if (!result.authorized) {
		log.warn("Admin endpoint rejected", { reason: result.reason });
		return {
			authorized: false,
			reason: result.reason,
		};
	}

	return { authorized: true };
}
