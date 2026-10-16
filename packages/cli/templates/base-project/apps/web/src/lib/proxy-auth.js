const STRICT_AUTH_RATE_LIMIT_ROUTES = new Set([
	// `callback/credentials` is where the next-auth client POSTs a credentials
	// sign-in (next-auth/react posts to `callback/<provider>` for credentials
	// providers), so this is the credential-stuffing surface and stays strict.
	// `signin/credentials` is deliberately NOT listed: no client POSTs there,
	// and @auth/core's POST `signin` action for a credentials provider just
	// redirects to the sign-in page — nothing to brute force.
	"/api/auth/callback/credentials",
	"/api/auth/register",
	// Password recovery surfaces are credential-adjacent and stay strict:
	// `forgot-password` is an email-sending surface (5 per 15 minutes per
	// IP:path stops an attacker from flooding one mailbox), and
	// `reset-password` is a token-redeeming surface (the same budget limits
	// grinding through stolen or guessed links).
	"/api/auth/forgot-password",
	"/api/auth/reset-password",
]);

/**
 * Routes that are never rate limited.
 *
 * `/api/health` is the platform healthcheck. It sits behind the same 100-req
 * `api` bucket as everything else, so a probe that lands in an already-full
 * bucket gets a 429 — the orchestrator reads that as unhealthy and restarts the
 * container, which fills the bucket again on startup. Limiting the probe is how
 * a healthy service gets killed.
 */
const RATE_LIMIT_EXEMPT_ROUTES = new Set(["/api/health"]);

function getForwardedProtocol(request) {
	const forwardedProto = request.headers.get("x-forwarded-proto");
	if (!forwardedProto) return null;

	const [protocol] = forwardedProto
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);

	if (!protocol) return null;
	return protocol.endsWith(":") ? protocol : `${protocol}:`;
}

function getFallbackProtocol() {
	const rawUrl =
		process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.APP_URL;

	if (!rawUrl) return "http:";

	try {
		return new URL(rawUrl).protocol;
	} catch {
		return "http:";
	}
}

export function getRequestProtocol(request) {
	return (
		getForwardedProtocol(request) ||
		request.nextUrl?.protocol ||
		getFallbackProtocol()
	);
}

export function shouldUseSecureAuthCookie(request) {
	const forwardedProtocol = getForwardedProtocol(request);
	if (forwardedProtocol) {
		return forwardedProtocol === "https:";
	}

	return getRequestProtocol(request) === "https:";
}

export async function getProxyToken(request) {
	const secret = getAuthSecret();
	if (!secret) return null;

	const secureCookiePreferences = shouldUseSecureAuthCookie(request)
		? [true, false]
		: [false, true];

	for (const secureCookie of secureCookiePreferences) {
		const token = await getToken({
			req: request,
			secret,
			secureCookie,
		});

		if (token) {
			return token;
		}
	}

	return null;
}

export function getRateLimitBucket(pathname, method = "GET") {
	return method === "POST" && STRICT_AUTH_RATE_LIMIT_ROUTES.has(pathname)
		? "auth"
		: "api";
}

/**
 * Whether a route bypasses rate limiting entirely.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isRateLimitExempt(pathname) {
	return RATE_LIMIT_EXEMPT_ROUTES.has(pathname);
}

/**
 * Boolean-like values that disable trusting proxy headers. Mirrors the
 * "explicit false wins" convention used by `AUTH_ALLOW_SIGNUP` and
 * `DB_INSTRUMENTATION`, so operators don't have to learn a new dialect.
 */
const PROXY_HEADERS_FALSY_VALUES = new Set(["false", "0", "no", "off"]);

/**
 * Whether the client-supplied proxy headers (`x-forwarded-for`, `x-real-ip`)
 * may be trusted to identify the client.
 *
 * Default `true`: the shipped behaviour. The app assumes it sits behind a
 * reverse proxy (Railway, Docker, nginx) that overwrites these headers on
 * every request, so the left-most `x-forwarded-for` entry is treated as the
 * client IP.
 *
 * Set `TRUST_PROXY_HEADERS=false` when the app is reachable directly (no
 * proxy rewriting the header on the way in). Callers must then ignore both
 * headers: proxy.js keys every client on the literal "unknown", and the
 * Umami ingest proxy forwards "unknown" instead of attacker bytes. A header
 * a client can set is not an identity.
 *
 * Read lazily (per request) rather than at module load: tests flip it and a
 * value set after import still takes effect. Only explicit false-like values
 * disable trusting; unset, empty, "true", or a typo all keep the default.
 *
 * @returns {boolean}
 */
export function shouldTrustProxyHeaders() {
	const raw = process.env.TRUST_PROXY_HEADERS?.trim().toLowerCase();
	return !(raw && PROXY_HEADERS_FALSY_VALUES.has(raw));
}
