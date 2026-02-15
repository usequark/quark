/**
 * CSRF Token API Endpoint
 * Generates a CSRF token, stores it in a secure HTTP-only cookie,
 * and returns it to the client for inclusion in request headers.
 */

import { generateCsrfToken } from "@techstream/quark-core";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
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
		const isProduction = process.env.NODE_ENV === "production";
		response.cookies.set("csrf_token", csrfToken, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "strict",
			path: "/",
			maxAge: 60 * 60, // 1 hour
		});

		return response;
	} catch (_error) {
		return NextResponse.json(
			{ error: "Failed to generate CSRF token" },
			{ status: 500 },
		);
	}
}
