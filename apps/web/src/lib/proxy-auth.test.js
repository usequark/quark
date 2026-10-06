import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server.js";
import { encode, getToken } from "next-auth/jwt";

import {
	getProxyToken,
	getRateLimitBucket,
	isRateLimitExempt,
	shouldUseSecureAuthCookie,
} from "./proxy-auth.js";

function snapshotEnv() {
	return {
		APP_URL: process.env.APP_URL,
		AUTH_URL: process.env.AUTH_URL,
		AUTH_SECRET: process.env.AUTH_SECRET,
		NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
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

test("getProxyToken decodes secure auth cookies for forwarded https requests", async () => {
	const previousEnv = snapshotEnv();
	process.env.NEXTAUTH_SECRET = "test-secret";

	try {
		const secureCookieName = "__Secure-authjs.session-token";
		const encodedToken = await encode({
			token: {
				sub: "user-1",
				role: "admin",
			},
			secret: process.env.NEXTAUTH_SECRET,
			salt: secureCookieName,
		});

		const request = new NextRequest("http://internal.test/admin", {
			headers: {
				cookie: `${secureCookieName}=${encodedToken}`,
				"x-forwarded-proto": "https",
			},
		});

		assert.equal(shouldUseSecureAuthCookie(request), true);

		const decodedToken = await getProxyToken(request);
		assert.equal(decodedToken?.sub, "user-1");
		assert.equal(decodedToken?.role, "admin");

		const defaultDecodedToken = await getToken({
			req: request,
			secret: process.env.NEXTAUTH_SECRET,
		});
		assert.equal(defaultDecodedToken, null);
	} finally {
		restoreEnv(previousEnv);
	}
});

test("getProxyToken falls back to AUTH_SECRET when NEXTAUTH_SECRET is absent", async () => {
	const previousEnv = snapshotEnv();
	delete process.env.NEXTAUTH_SECRET;
	process.env.AUTH_SECRET = "test-secret";

	try {
		const secureCookieName = "__Secure-authjs.session-token";
		const encodedToken = await encode({
			token: {
				sub: "user-1b",
				role: "admin",
			},
			secret: process.env.AUTH_SECRET,
			salt: secureCookieName,
		});

		const request = new NextRequest("http://internal.test/admin", {
			headers: {
				cookie: `${secureCookieName}=${encodedToken}`,
				"x-forwarded-proto": "https",
			},
		});

		const decodedToken = await getProxyToken(request);
		assert.equal(decodedToken?.sub, "user-1b");
		assert.equal(decodedToken?.role, "admin");
	} finally {
		restoreEnv(previousEnv);
	}
});

test("getProxyToken falls back to the alternate auth cookie variant when needed", async () => {
	const previousEnv = snapshotEnv();
	process.env.NEXTAUTH_SECRET = "test-secret";

	try {
		const secureCookieName = "__Secure-authjs.session-token";
		const encodedToken = await encode({
			token: {
				sub: "user-2",
				role: "admin",
			},
			secret: process.env.NEXTAUTH_SECRET,
			salt: secureCookieName,
		});

		const request = new NextRequest("http://internal.test/admin", {
			headers: {
				cookie: `${secureCookieName}=${encodedToken}`,
			},
		});

		assert.equal(shouldUseSecureAuthCookie(request), false);

		const decodedToken = await getProxyToken(request);
		assert.equal(decodedToken?.sub, "user-2");
		assert.equal(decodedToken?.role, "admin");
	} finally {
		restoreEnv(previousEnv);
	}
});

test("getRateLimitBucket only applies strict auth limits to credential writes", () => {
	assert.equal(getRateLimitBucket("/api/auth/providers", "GET"), "api");
	assert.equal(getRateLimitBucket("/api/auth/csrf", "GET"), "api");
	assert.equal(getRateLimitBucket("/api/auth/session", "GET"), "api");
	assert.equal(
		getRateLimitBucket("/api/auth/callback/credentials", "POST"),
		"auth",
	);
	assert.equal(
		getRateLimitBucket("/api/auth/signin/credentials", "POST"),
		"auth",
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
