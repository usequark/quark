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
 * Helper: make a JSON request to the API
 */
async function api(path, options = {}) {
	const { method = "GET", body, headers = {}, cookies } = options;

	const fetchHeaders = {
		"Content-Type": "application/json",
		...headers,
	};

	if (cookies) {
		fetchHeaders.Cookie = cookies;
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
		it("should register a new user", async () => {
			const email = testEmail();
			const { status, data } = await api("/api/auth/register", {
				method: "POST",
				body: { email, password: "SecurePass123!", name: "Test User" },
			});
			assert.strictEqual(status, 201);
			assert.ok(data.user);
			assert.strictEqual(data.user.email, email);
		});

		it("should reject duplicate email", async () => {
			const email = testEmail();
			// Register first
			await api("/api/auth/register", {
				method: "POST",
				body: { email, password: "SecurePass123!", name: "Test" },
			});
			// Try again
			const { status } = await api("/api/auth/register", {
				method: "POST",
				body: { email, password: "SecurePass123!", name: "Test" },
			});
			assert.ok(
				[400, 409, 422].includes(status),
				`Expected 400/409/422, got ${status}`,
			);
		});

		it("should reject missing password", async () => {
			const { status } = await api("/api/auth/register", {
				method: "POST",
				body: { email: testEmail() },
			});
			assert.ok([400, 422].includes(status), `Expected 400/422, got ${status}`);
		});

		it("should reject invalid email format", async () => {
			const { status } = await api("/api/auth/register", {
				method: "POST",
				body: { email: "not-an-email", password: "SecurePass123!" },
			});
			assert.ok([400, 422].includes(status), `Expected 400/422, got ${status}`);
		});
	});

	describe("GET /api/users", () => {
		it("should reject unauthenticated requests", async () => {
			const { status } = await api("/api/users");
			assert.ok([401, 403].includes(status), `Expected 401/403, got ${status}`);
		});
	});

	describe("Rate Limiting", () => {
		it("should include rate limit headers on API responses", async () => {
			const { headers } = await api("/api/health");
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
