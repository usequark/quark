/**
 * CSRF Token API Endpoint
 * Generates a CSRF token, stores it in a secure HTTP-only cookie,
 * and returns it to the client for inclusion in request headers.
 */

import { generateCsrfToken } from "@techstream/quark-core";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCsrfCookieOptions } from "@/lib/csrf-cookie";

export async function GET(request) {
	try {
		const session = await auth();

		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Generate CSRF token
		const csrfToken = generateCsrfToken();

		const response = NextResponse.json({ csrfToken });

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
			{ status: 500 },
		);
	}
}
