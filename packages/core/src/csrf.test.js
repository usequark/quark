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
 * @param {Record<string, string>} [opts.headers={}] - lowercase header names
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

	await t.test(
		"requireCsrfToken no longer skips /api/auth/ paths",
		async () => {
			// The exemption existed for NextAuth, and it was costing more than it
			// bought: every hand-written route filed under that prefix inherited it.
			// `/api/auth/register` is the one that mattered — its wrapper was inert.
			// NextAuth itself is unaffected because `app/api/auth/[...nextauth]/route.js`
			// exports `handlers.POST` directly and never calls `withCsrfProtection`,
			// so no request to `/api/auth/signin` reaches this function at all.
			const request = mockRequest({
				method: "POST",
				url: "http://localhost/api/auth/register",
			});

			assert.throws(() => requireCsrfToken(request), /CSRF token not found/);
		},
	);

	await t.test("a NextAuth callback path is not exempted either", async () => {
		// Guards the reasoning above: if a NextAuth request ever did reach this
		// function, it would be rejected. That is correct, because it cannot
		// happen - and if it ever starts happening, this fails loudly instead of
		// silently relying on an exemption that no longer exists.
		const request = mockRequest({
			method: "POST",
			url: "http://localhost/api/auth/callback/credentials",
		});

		assert.throws(() => requireCsrfToken(request), /CSRF token not found/);
	});

	await t.test(
		"a hand-written /api/auth/ route with a valid token passes",
		async () => {
			// The fix must narrow the exemption, not break the route. A matching
			// cookie/header pair is all `/api/auth/register` ever needed.
			const token = generateCsrfToken();
			const request = mockRequest({
				method: "POST",
				url: "http://localhost/api/auth/register",
				headers: {
					"x-csrf-token": token,
					cookie: `csrf_token=${encodeURIComponent(token)}`,
				},
			});

			assert.doesNotThrow(() => {
				requireCsrfToken(request);
			});
		},
	);

	await t.test("requireCsrfToken skips Bearer-authenticated requests", () => {
		const request = mockRequest({
			method: "POST",
			url: "http://localhost/api/device/register",
			headers: { authorization: "Bearer some-jwt-token" },
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

	await t.test(
		"withCsrfProtection returns 401 instead of throwing",
		async () => {
			// The check runs in the wrapper, outside the route handler's own
			// try/catch, so a throw here escapes `handleError` and reaches the client
			// as an unhandled rejection. The status code is what fetch handling expects.
			const request = mockRequest({
				method: "POST",
				url: "http://localhost/api/posts",
				headers: { "x-csrf-token": generateCsrfToken() },
			});

			let handlerCalled = false;
			const protectedHandler = withCsrfProtection(async () => {
				handlerCalled = true;
				return { unreachable: true };
			});

			const response = await protectedHandler(request);

			assert(response instanceof Response);
			assert.strictEqual(response.status, 401);
			assert.strictEqual(response.headers.get("Cache-Control"), "no-store");

			const body = await response.json();
			assert.strictEqual(body.code, "UNAUTHORIZED");
			assert.strictEqual(body.statusCode, 401);
			// The handler must not run on a rejected token.
			assert.strictEqual(handlerCalled, false);
		},
	);

	await t.test(
		"withCsrfProtection returns 401 for a mismatched token",
		async () => {
			const token = generateCsrfToken();
			const request = mockRequest({
				method: "POST",
				url: "http://localhost/api/posts",
				headers: {
					"x-csrf-token": "wrong-token-of-same-len",
					cookie: `csrf_token=${encodeURIComponent(token)}`,
				},
			});

			const protectedHandler = withCsrfProtection(async () => ({
				unreachable: true,
			}));
			const response = await protectedHandler(request);

			assert.strictEqual(response.status, 401);
		},
	);

	await t.test(
		"withCsrfProtection still rejects for a non-CSRF error",
		async () => {
			// Only UnauthorizedError is converted. Anything else from the check is a
			// genuine fault and must keep propagating rather than being reported to the
			// client as an authentication problem.
			const request = mockRequest({ method: "POST" });
			request.headers.get = () => {
				throw new TypeError("headers.get exploded");
			};

			const protectedHandler = withCsrfProtection(async () => ({
				unreachable: true,
			}));

			await assert.rejects(
				() => protectedHandler(request),
				/headers.get exploded/,
			);
		},
	);
});
