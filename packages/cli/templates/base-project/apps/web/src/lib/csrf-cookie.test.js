import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server.js";

import { getCsrfCookieOptions } from "./csrf-cookie.js";

function snapshotEnv() {
	return {
		APP_URL: process.env.APP_URL,
		AUTH_URL: process.env.AUTH_URL,
		NEXTAUTH_URL: process.env.NEXTAUTH_URL,
	};
}

function restoreEnv(snapshot) {
	for (const [key, value] of Object.entries(snapshot)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

test("getCsrfCookieOptions marks cookies secure for forwarded https requests", () => {
	const request = new NextRequest("http://internal.test/api/csrf", {
		headers: {
			"x-forwarded-proto": "https",
		},
	});

	assert.equal(getCsrfCookieOptions(request).secure, true);
});

test("getCsrfCookieOptions leaves cookies insecure for forwarded http requests", () => {
	const request = new NextRequest("https://public.test/api/csrf", {
		headers: {
			"x-forwarded-proto": "http",
		},
	});

	assert.equal(getCsrfCookieOptions(request).secure, false);
});

test("getCsrfCookieOptions falls back to request protocol when not forwarded", () => {
	const previousEnv = snapshotEnv();
	delete process.env.AUTH_URL;
	delete process.env.NEXTAUTH_URL;
	delete process.env.APP_URL;

	try {
		const request = new NextRequest("https://public.test/api/csrf");
		assert.equal(getCsrfCookieOptions(request).secure, true);
	} finally {
		restoreEnv(previousEnv);
	}
});

test("getCsrfCookieOptions falls back to configured app url when request is internal", () => {
	const previousEnv = snapshotEnv();
	process.env.APP_URL = "https://app.example.com";

	try {
		const request = new Request("http://internal.test/api/csrf");
		assert.equal(getCsrfCookieOptions(request).secure, true);
	} finally {
		restoreEnv(previousEnv);
	}
});
