import { getAuthSecret } from "@techstream/quark-core/auth";
import { getToken } from "next-auth/jwt";

const STRICT_AUTH_RATE_LIMIT_ROUTES = new Set([
	"/api/auth/callback/credentials",
	"/api/auth/register",
	"/api/auth/signin/credentials",
]);

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
