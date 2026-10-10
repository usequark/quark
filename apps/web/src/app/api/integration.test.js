/**
 * API Integration Tests
 * Tests the actual API routes against a running Next.js server.
 *
 * Prerequisites:
 * - Docker services running (postgres, redis)
 * - Database migrated (pnpm db:migrate)
 *
 * Run: node --test src/app/api/integration.test.js
 */

import assert from "node:assert";
import { describe, it } from "node:test";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

/**
 * A CSRF cookie/header pair for a mutating request.
 *
 * `/api/auth/register` is wrapped in `withCsrfProtection`, so it rejects any
 * write whose header does not match the httpOnly `csrf_token` cookie. Real
 * clients fetch `GET /api/csrf` first; these tests do the same rather than
 * asserting around the check. Cached because the token is reusable until its
 * cookie expires, and each call would otherwise mint a fresh one.
 */
let csrfPair;

/** @returns {Promise<{headers: Object, cookies: string}>} */
async function csrfAuth() {
	if (!csrfPair) {
		const { data } = await api("/api/csrf");
		assert.ok(
			data?.csrfToken,
			"GET /api/csrf returned no token - the rest of this file cannot authenticate",
		);
		csrfPair = {
			headers: { "X-CSRF-Token": data.csrfToken },
			cookies: `csrf_token=${encodeURIComponent(data.csrfToken)}`,
		};
	}
	return csrfPair;
}

/**
 * A distinct client identity per test run.
 *
 * The `auth` bucket counts `ip:path`, so every run that presents the same IP
 * inherits the previous run's counter — and a re-run against the same server
 * inside the 15-minute window then fails on 429s, a failure about the limiter's
 * memory rather than about anything the routes under test did. Each run is a
 * new client, which is what a re-run actually is.
 */
const RUN_IP = `203.0.113.${10 + Math.floor(Math.random() * 200)}`;

/**
 * Helper: make a JSON request to the API
 */
async function api(path, options = {}) {
	const { method = "GET", body, headers = {}, cookies, ip } = options;

	const fetchHeaders = {
		"Content-Type": "application/json",
		...headers,
	};

	if (cookies) {
		fetchHeaders.Cookie = cookies;
	}

	if (ip) {
		fetchHeaders["X-Forwarded-For"] = ip;
	}

	const response = await fetch(`${BASE_URL}${path}`, {
		method,
		headers: fetchHeaders,
		...(body && { body: JSON.stringify(body) }),
		redirect: "manual",
	});

	let data = null;
	const contentType = response.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		data = await response.json();
	}

	return { status: response.status, data, headers: response.headers };
}

/**
 * Generate a unique test email to avoid collision
 */
function testEmail() {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe("API Integration Tests", () => {
	describe("GET /api/health", () => {
		it("should return 200 with status ok", async () => {
			const { status, data } = await api("/api/health");
			assert.strictEqual(status, 200);
			assert.strictEqual(data.status, "ok");
		});

		it("should include security headers", async () => {
			const { headers } = await api("/api/health");
			assert.ok(headers.get("x-content-type-options"));
			assert.ok(headers.get("x-frame-options"));
		});
	});

	describe("POST /api/auth/register", () => {
		// The `auth` rate-limit bucket allows 5 POSTs per 15 minutes per
		// `ip:path`. Every request here carries RUN_IP, so the three calls this
		// block makes (forgery, create + duplicate as one test) sit in a counter
		// no other run touches — see RUN_IP above. Body-validation cases
		// (missing password, bad email) are NOT tested here:
		// register/route.test.js covers them against the real schema with
		// stronger assertions, and each one here would spend a slot in the same
		// bucket. If you add a case that must POST to register, reuse RUN_IP and
		// keep the block's total under 5, or assert through a route outside the
		// bucket; see the forgery case below for the pattern.
		it("should reject a cross-site write that carries no CSRF token", async () => {
			// The forgery this endpoint has to refuse: a request from another
			// origin, which the browser sends without the SameSite=Strict cookie.
			// Asserted against a running server, because the cookie's behaviour is
			// the browser's, not the route's.
			const email = testEmail();
			const password = "SecurePass123!";

			const forged = await api("/api/auth/register", {
				method: "POST",
				ip: RUN_IP,
				body: { email, password, name: "Forged" },
			});

			assert.strictEqual(
				forged.status,
				401,
				"a cross-site write with no CSRF token was not rejected",
			);

			// Prove nothing was created, without spending a second slot in the
			// auth bucket: `/api/auth/token` sits in the general `api` bucket and
			// answers 401 unless a real account with that password exists.
			const probe = await api("/api/auth/token", {
				method: "POST",
				body: { email, password },
			});
			assert.strictEqual(
				probe.status,
				401,
				"the rejected request still created a usable account",
			);
		});

		it("should register a new user and reject a duplicate email", async () => {
			const email = testEmail();
			const csrf = await csrfAuth();

			const created = await api("/api/auth/register", {
				method: "POST",
				ip: RUN_IP,
				body: { email, password: "SecurePass123!", name: "Test User" },
				...csrf,
			});
			assert.strictEqual(created.status, 201);
			assert.ok(created.data);
			assert.strictEqual(created.data.email, email);

			const duplicate = await api("/api/auth/register", {
				method: "POST",
				ip: RUN_IP,
				body: { email, password: "SecurePass123!", name: "Test User" },
				...csrf,
			});
			assert.ok(
				[400, 409, 422].includes(duplicate.status),
				`Expected 400/409/422 for a duplicate, got ${duplicate.status}`,
			);
		});
	});

	describe("GET /api/users", () => {
		it("should reject unauthenticated requests", async () => {
			const { status } = await api("/api/users");
			assert.ok([401, 403].includes(status), `Expected 401/403, got ${status}`);
		});
	});

	describe("Rate Limiting", () => {
		it("should include rate limit headers on rate-limited responses", async () => {
			// A limited route, not `/api/health`: the healthcheck is exempt by
			// design (proxy.js skips the bucket entirely for exempt paths), so
			// the headers this test asserts are absent there by intent. See
			// lib/proxy-auth.js for why the probe must never be limited.
			const { headers } = await api("/api/users");
			assert.ok(
				headers.get("x-ratelimit-limit"),
				"Should have X-RateLimit-Limit header",
			);
			assert.ok(
				headers.get("x-ratelimit-remaining"),
				"Should have X-RateLimit-Remaining header",
			);
		});
	});

	describe("CORS", () => {
		it("should handle OPTIONS preflight requests", async () => {
			const response = await fetch(`${BASE_URL}/api/health`, {
				method: "OPTIONS",
				headers: {
					Origin: "http://localhost:3000",
					"Access-Control-Request-Method": "GET",
				},
			});
			assert.strictEqual(response.status, 204);
		});
	});
});

// --- E2E Tests (stub) ---
describe("E2E Tests", () => {
	it.todo("should be implemented when the app has pages to test");
	// TODO: Quark ships no pages by default.
	// When pages are added to a scaffolded project, add E2E tests here
	// using Playwright or similar.
});
