import { shouldUseSecureAuthCookie } from "./proxy-auth.js";

export function getCsrfCookieOptions(request) {
	return {
		httpOnly: true,
		secure: shouldUseSecureAuthCookie(request),
		sameSite: "strict",
		path: "/",
		maxAge: 60 * 60,
	};
}
