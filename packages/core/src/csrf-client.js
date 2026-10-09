/**
 * @usequark/quark-core - CSRF Client Helpers
 * Browser-safe companion to `csrf.js`, for the "use client" side of the
 * double-submit handshake.
 *
 * ## Why this is a separate module
 *
 * `csrf.js` imports `node:crypto`. A client component cannot reach this module
 * through the `@usequark/quark-core` barrel without dragging that Node builtin
 * into the browser bundle, which fails the build. This file therefore imports
 * nothing at all, and is published as its own subpath export:
 *
 * ```js
 * import { getCsrfToken } from "@usequark/quark-core/csrf-client";
 * ```
 */

/** Endpoint that mints a token and sets the matching cookie. */
const DEFAULT_ENDPOINT = "/api/csrf";

/**
 * Cached tokens are treated as expired after this long.
 *
 * `/api/csrf` writes the cookie with a one-hour `maxAge`. A token cached past
 * that point outlives the cookie it has to match, and the next write fails
 * with "CSRF token not found" — a confusing message for what is really a stale
 * token. Refetching ahead of the cookie's own expiry keeps the two in step.
 */
const TOKEN_TTL_MS = 50 * 60 * 1000;

/** The cached token, and the timestamp at which it stops being usable. */
let cachedToken = null;
let cachedUntil = 0;

/**
 * The in-flight request, shared so that N callers racing on a cold cache make
 * one HTTP request rather than N. Reset when it settles.
 */
let inflight = null;

/**
 * Bumped by `clearCsrfToken`. A request that started before the clear must not
 * repopulate the cache with the token the caller just threw away.
 */
let generation = 0;

/**
 * Drops any cached token, forcing the next `getCsrfToken` to hit the endpoint.
 *
 * Only needed when the server has rotated the cookie underneath the client — a
 * sign-out that clears cookies, or a 401 from a write that suggests the cached
 * token and the cookie no longer agree. Ordinary expiry needs no call: the
 * cache refetches itself.
 *
 * @returns {void}
 */
export function clearCsrfToken() {
	generation++;
	cachedToken = null;
	cachedUntil = 0;
	inflight = null;
}

/**
 * Returns a CSRF token, fetching one if the cache is cold or stale.
 *
 * The caller must send the token in the `x-csrf-token` header of a mutating
 * request; `/api/csrf` has also set the matching `httpOnly` cookie, and the
 * server compares the two. Because that cookie is `SameSite=Strict`, a
 * cross-site request never carries it and is rejected before the handler runs —
 * which is why this token has to be obtainable *before* authentication.
 *
 * @param {Object} [options]
 * @param {string} [options.endpoint] - Token endpoint (default `/api/csrf`)
 * @param {() => number} [options.now] - Clock override, for tests
 * @returns {Promise<string>} The token to send as `x-csrf-token`
 * @throws {Error} If the endpoint fails or returns no token
 */
export async function getCsrfToken(options = {}) {
	const { endpoint = DEFAULT_ENDPOINT, now = Date.now } = options;

	if (cachedToken && now() < cachedUntil) {
		return cachedToken;
	}

	if (inflight) {
		return inflight;
	}

	const startedAt = generation;

	const request = (async () => {
		const response = await fetch(endpoint, {
			credentials: "same-origin",
			headers: { accept: "application/json" },
			cache: "no-store",
		});

		if (!response.ok) {
			throw new Error(
				`Could not fetch a CSRF token from ${endpoint}: ${response.status}`,
			);
		}

		const body = await response.json();
		if (!body?.csrfToken) {
			throw new Error(`${endpoint} did not return a csrfToken`);
		}

		if (startedAt === generation) {
			cachedToken = body.csrfToken;
			cachedUntil = now() + TOKEN_TTL_MS;
		}

		return body.csrfToken;
	})();

	inflight = request;

	// Both settle paths release the slot. `then(cleanup, cleanup)` rather than
	// `finally`, which would leave the returned promise's rejection unhandled.
	const cleanup = () => {
		if (inflight === request) {
			inflight = null;
		}
	};
	request.then(cleanup, cleanup);

	return request;
}
