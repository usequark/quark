import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server.js";

import { normalizeAuthRequest } from "./normalize-auth-request.js";

test("normalizeAuthRequest preserves NextRequest semantics for forwarded dev hosts", () => {
	const previousNodeEnv = process.env.NODE_ENV;
	const previousNextAuthUrl = process.env.NEXTAUTH_URL;

	process.env.NODE_ENV = "development";
	process.env.NEXTAUTH_URL = "http://localhost:3005";

	try {
		const request = new NextRequest("http://localhost:3005/api/auth/session", {
			headers: {
				host: "localhost:3005",
				"x-forwarded-host": "192.168.1.9:3005",
				"x-forwarded-proto": "http",
			},
		});
		const brokenNormalized = new Request(
			"http://192.168.1.9:3005/api/auth/session",
			request,
		);

		const normalized = normalizeAuthRequest(request);

		assert.equal(brokenNormalized.nextUrl, undefined);
		assert.ok(normalized instanceof NextRequest);
		assert.equal(normalized.nextUrl.origin, "http://192.168.1.9:3005");
		assert.equal(
			normalized.headers.get("x-forwarded-host"),
			"192.168.1.9:3005",
		);
	} finally {
		if (previousNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = previousNodeEnv;
		}

		if (previousNextAuthUrl === undefined) {
			delete process.env.NEXTAUTH_URL;
		} else {
			process.env.NEXTAUTH_URL = previousNextAuthUrl;
		}
	}
});
