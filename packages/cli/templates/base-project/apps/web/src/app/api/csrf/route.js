/**
 * CSRF Token API Endpoint
 * Generates a CSRF token, stores it in a secure HTTP-only cookie,
 * and returns it to the client for inclusion in request headers.
 */

import { generateCsrfToken } from "@usequark/quark-core";
import { NextResponse } from "next/server";
import { getCsrfCookieOptions } from "@/lib/csrf-cookie";

/**
 * Headers applied to every response.
 *
 * `no-store` is load-bearing, not hygiene. The body of this response *is* a
 * write credential: paired with the cookie it sets, it authorises the holder's
 * next mutating request. A shared cache that stored it could hand the token to
 * a second caller, who would then be able to write as the first — so this
 * response must never be cached, by the browser or anything between it and the
 * client. `Vary: Cookie` keeps that true for a cache that keys on request
 * headers rather than obeying `no-store` outright.
 */
const NO_STORE_HEADERS = {
	"Cache-Control": "no-store, no-cache, must-revalidate",
	Vary: "Cookie",
};

export async function GET(request) {
	try {
		const csrfToken = generateCsrfToken();

		const response = NextResponse.json(
			{ csrfToken },
			{ headers: NO_STORE_HEADERS },
		);

		// Store the token in a secure HTTP-only cookie so the server can
		// validate it on subsequent state-changing requests.
		response.cookies.set(
			"csrf_token",
			csrfToken,
			getCsrfCookieOptions(request),
		);

		return response;
	} catch (_error) {
		return NextResponse.json(
			{ error: "Failed to generate CSRF token" },
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
