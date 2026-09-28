/**
 * APP_URL - Single source of truth for the application's canonical URL.
 *
 * Resolution order:
 *   1. APP_URL          (canonical origin - set it in every environment)
 *   2. NEXTAUTH_URL     (legacy / backward-compat)
 *   3. http://localhost:${PORT || 3000}   (local dev fallback)
 *
 * In development PORT is the default source for the web server port, but
 * APP_URL should still be set explicitly whenever the origin you browse on is
 * not exactly localhost:PORT (127.0.0.1, a LAN IP, a tunnel, another port).
 * Auth.js derives its post-sign-in redirect and its client-side base URL from
 * this value, so a mismatch silently drops the session.
 * In production, set APP_URL explicitly (e.g. https://yourdomain.com).
 *
 * Derived values:
 *   - NEXTAUTH_URL  - always set equal to the resolved APP_URL so
 *                      NextAuth works without a separate variable.
 *   - allowedOrigins - the resolved APP_URL plus any extra origins
 *                      listed in ALLOWED_ORIGINS (comma-separated).
 */

import { ValidationError } from "@techstream/quark-core/errors";

/**
 * Resolves the canonical application URL.
 * @returns {string} The canonical URL (no trailing slash)
 */
export function getAppUrl() {
	const configuredAppUrl = process.env.APP_URL?.trim();
	if (configuredAppUrl) {
		return normalizeAppUrl(configuredAppUrl, "APP_URL");
	}

	const configuredNextAuthUrl = process.env.NEXTAUTH_URL?.trim();
	if (configuredNextAuthUrl) {
		return normalizeAppUrl(configuredNextAuthUrl, "NEXTAUTH_URL");
	}

	const fallbackPort = resolveLocalPort(process.env.PORT);

	return normalizeAppUrl(`http://localhost:${fallbackPort}`, "derived APP_URL");
}

function resolveLocalPort(value) {
	const parsedPort = Number.parseInt(value, 10);
	if (Number.isInteger(parsedPort) && parsedPort > 0) {
		return String(parsedPort);
	}

	return "3000";
}

function normalizeAppUrl(rawUrl, label) {
	let parsedUrl;

	try {
		parsedUrl = new URL(rawUrl);
	} catch {
		throw new ValidationError(
			`${label} must be an absolute http(s) URL. Received: ${rawUrl}`,
		);
	}

	if (!["http:", "https:"].includes(parsedUrl.protocol)) {
		throw new ValidationError(
			`${label} must use http:// or https://. Received: ${rawUrl}`,
		);
	}

	return parsedUrl.toString().replace(/\/+$/, "");
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

	// In development, allow the ports the dev server actually listens on plus
	// the loopback aliases people type by hand. `getEnvironmentConfig()` returns
	// the hard-coded default (3000) and ignores `process.env.PORT`, so reading it
	// here silently drifted from the real port whenever PORT was overridden.
	const isDev = process.env.NODE_ENV !== "production";
	// resolveLocalPort() returns a string - parse before doing arithmetic or
	// "3000" + 1 silently becomes "30001".
	const devPort = Number.parseInt(resolveLocalPort(process.env.PORT), 10);
	const devOrigins = isDev
		? [
				`http://localhost:${devPort}`,
				`http://localhost:${devPort + 1}`,
				`http://127.0.0.1:${devPort}`,
				`http://127.0.0.1:${devPort + 1}`,
			]
		: [];

	// Extra LAN/VPN dev hosts accepted by next.config.js `allowedDevOrigins`,
	// so CORS and the Next.js dev host allow-list stay in agreement.
	const devHostExtras = isDev
		? ["NEXT_DEV_ALLOWED_ORIGINS", "ALLOWED_DEV_ORIGINS"].flatMap((key) =>
				(process.env[key] ?? "")
					.split(",")
					.map((host) => host.trim())
					.filter(Boolean)
					.map((host) => (host.includes("://") ? host : `http://${host}`)),
			)
		: [];

	// De-duplicate
	return [...new Set([canonical, ...extras, ...devOrigins, ...devHostExtras])];
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
