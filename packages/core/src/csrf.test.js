import assert from "node:assert";
import { test } from "node:test";
import {
	generateCsrfToken,
	requireCsrfToken,
	validateCsrfToken,
	withCsrfProtection,
} from "../src/csrf.js";

/**
 * Creates a mock Request-like object for testing.
 * @param {Object} opts
 * @param {string} [opts.method="GET"]
 * @param {string} [opts.url="http://localhost/api/test"]
 * @param {Record<string, string>} [opts.headers={}] — lowercase header names
 */
function mockRequest({
	method = "GET",
	url = "http://localhost/api/test",
	headers = {},
} = {}) {
	const map = new Map(Object.entries(headers));
	return {
		method,
		url,
		headers: {
			get(key) {
				return map.get(key) ?? null;
			},
		},
	};
}

test("CSRF Module", async (t) => {
	await t.test("generateCsrfToken creates a secure token", () => {
		const token1 = generateCsrfToken();
		const token2 = generateCsrfToken();

		assert(token1.length > 0);
		assert(token2.length > 0);
		assert(token1 !== token2, "Tokens should be unique");
	});

	await t.test("validateCsrfToken accepts valid token", () => {
		const token = generateCsrfToken();
		const request = mockRequest({ headers: { "x-csrf-token": token } });

		assert.doesNotThrow(() => {
			validateCsrfToken(request, token);
		});
	});

	await t.test("validateCsrfToken rejects missing header token", () => {
		const token = generateCsrfToken();
		const request = mockRequest();

		assert.throws(
			() => validateCsrfToken(request, token),
			/CSRF token missing/,
		);
	});

	await t.test("validateCsrfToken rejects missing session token", () => {
		const request = mockRequest({ headers: { "x-csrf-token": "some-token" } });

		assert.throws(
			() => validateCsrfToken(request, null),
			/No CSRF token in session/,
		);
	});

	await t.test("validateCsrfToken rejects mismatched tokens", () => {
		const token = generateCsrfToken();
		const request = mockRequest({
			headers: { "x-csrf-token": "wrong-token-of-same-len" },
		});

		assert.throws(
			() => validateCsrfToken(request, token),
			/Invalid CSRF token/,
		);
	});

	await t.test("validateCsrfToken rejects tokens of different lengths", () => {
		const request = mockRequest({ headers: { "x-csrf-token": "short" } });

		assert.throws(
			() => validateCsrfToken(request, "a-much-longer-session-token"),
			/Invalid CSRF token/,
		);
	});

	await t.test("requireCsrfToken skips GET requests", () => {
		const request = mockRequest({ method: "GET" });

		assert.doesNotThrow(() => {
			requireCsrfToken(request);
		});
	});

	await t.test("requireCsrfToken skips NextAuth routes", () => {
		const request = mockRequest({
			method: "POST",
			url: "http://localhost/api/auth/signin",
		});

		assert.doesNotThrow(() => {
			requireCsrfToken(request);
		});
	});

	await t.test("requireCsrfToken validates POST with cookie token", () => {
		const token = generateCsrfToken();
		const request = mockRequest({
			method: "POST",
			url: "http://localhost/api/posts",
			headers: {
				"x-csrf-token": token,
				cookie: `csrf_token=${encodeURIComponent(token)}; other=value`,
			},
		});

		assert.doesNotThrow(() => {
			requireCsrfToken(request);
		});
	});

	await t.test("requireCsrfToken throws when cookie is missing", () => {
		const token = generateCsrfToken();
		const request = mockRequest({
			method: "POST",
			url: "http://localhost/api/posts",
			headers: { "x-csrf-token": token },
		});

		assert.throws(() => requireCsrfToken(request), /CSRF token not found/);
	});

	await t.test("withCsrfProtection wraps handler", async () => {
		const token = generateCsrfToken();
		const request = mockRequest({
			method: "POST",
			url: "http://localhost/api/posts",
			headers: {
				"x-csrf-token": token,
				cookie: `csrf_token=${encodeURIComponent(token)}`,
			},
		});

		const handler = async (req) => ({ body: "success", request: req });
		const protectedHandler = withCsrfProtection(handler);
		const result = await protectedHandler(request);

		assert.strictEqual(result.body, "success");
		assert.strictEqual(result.request, request);
	});
});
