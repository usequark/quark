import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server.js";

import {
	getRateLimitBucket,
	isRateLimitExempt,
	shouldUseSecureAuthCookie,
} from "./proxy-auth.js";

test("shouldUseSecureAuthCookie follows the forwarded protocol, then the request URL", () => {
	const httpsRequest = new NextRequest("http://internal.test/admin", {
		headers: {
			cookie: "authjs.session-token=token",
			"x-forwarded-proto": "https",
		},
	});
	assert.equal(shouldUseSecureAuthCookie(httpsRequest), true);

	const plainRequest = new NextRequest("http://internal.test/admin", {
		headers: {
			cookie: "authjs.session-token=token",
		},
	});
	assert.equal(shouldUseSecureAuthCookie(plainRequest), false);
});

test("getRateLimitBucket only applies strict auth limits to credential writes", () => {
	assert.equal(getRateLimitBucket("/api/auth/providers", "GET"), "api");
	assert.equal(getRateLimitBucket("/api/auth/csrf", "GET"), "api");
	assert.equal(getRateLimitBucket("/api/auth/session", "GET"), "api");
	assert.equal(
		getRateLimitBucket("/api/auth/callback/credentials", "POST"),
		"auth",
	);
	// The v5 client POSTs credentials sign-ins to `callback/credentials`; the
	// `signin/credentials` POST only redirects, so it stays in the general
	// bucket rather than spending the 5-request auth budget on a no-op.
	assert.equal(
		getRateLimitBucket("/api/auth/signin/credentials", "POST"),
		"api",
	);
	assert.equal(getRateLimitBucket("/api/auth/register", "POST"), "auth");
	assert.equal(getRateLimitBucket("/api/auth/signout", "POST"), "api");
});

test("isRateLimitExempt covers the healthcheck and nothing else", () => {
	assert.equal(isRateLimitExempt("/api/health"), true);
	assert.equal(isRateLimitExempt("/api/health/"), false);
	assert.equal(isRateLimitExempt("/api/health/deep"), false);
	assert.equal(isRateLimitExempt("/api/healthcheck"), false);
	assert.equal(isRateLimitExempt("/api/metrics"), false);
	assert.equal(isRateLimitExempt("/api/auth/signin/credentials"), false);
	assert.equal(isRateLimitExempt("/dashboard"), false);
});
