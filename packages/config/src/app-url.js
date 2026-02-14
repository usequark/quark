/**
 * APP_URL — Single source of truth for the application's canonical URL.
 *
 * Resolution order:
 *   1. APP_URL          (recommended)
 *   2. NEXTAUTH_URL     (legacy / backward-compat)
 *   3. http://localhost:${WEB_PORT || 3000}   (local dev fallback)
 *
 * Derived values:
 *   - NEXTAUTH_URL  — always set equal to the resolved APP_URL so
 *                      NextAuth works without a separate variable.
 *   - allowedOrigins — the resolved APP_URL plus any extra origins
 *                      listed in ALLOWED_ORIGINS (comma-separated).
 */

/**
 * Resolves the canonical application URL.
 * @returns {string} The canonical URL (no trailing slash)
 */
export function getAppUrl() {
	const raw =
		process.env.APP_URL ||
		process.env.NEXTAUTH_URL ||
		`http://localhost:${process.env.WEB_PORT || "3000"}`;

	// Strip trailing slash for consistency
	return raw.replace(/\/+$/, "");
}

/**
 * Returns the list of allowed CORS origins.
 *
 * Always includes the canonical APP_URL.
 * If ALLOWED_ORIGINS is set, those are *added* (not replacing) the canonical
 * origin so the primary domain is never accidentally excluded.
 *
 * @returns {string[]} De-duplicated list of allowed origins
 */
export function getAllowedOrigins() {
	const canonical = getAppUrl();
	const extras = process.env.ALLOWED_ORIGINS
		? process.env.ALLOWED_ORIGINS.split(",")
				.map((o) => o.trim())
				.filter(Boolean)
		: [];

	// In development, always allow the common local ports
	const isDev = process.env.NODE_ENV !== "production";
	const devOrigins = isDev
		? ["http://localhost:3000", "http://localhost:3001"]
		: [];

	// De-duplicate
	return [...new Set([canonical, ...extras, ...devOrigins])];
}

/**
 * Ensures NEXTAUTH_URL is set in process.env so NextAuth picks it up,
 * even when only APP_URL was configured.
 *
 * Call this once at startup (e.g. in your env validation step).
 */
export function syncNextAuthUrl() {
	if (!process.env.NEXTAUTH_URL) {
		process.env.NEXTAUTH_URL = getAppUrl();
	}
}
