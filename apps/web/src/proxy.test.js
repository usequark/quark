import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server.js";

import { proxy } from "./proxy.js";

// The auth bucket allows 5 requests per window; `api` allows 100.
const AUTH_ROUTE = "/api/auth/signin/credentials";

function authRequest(forwardedIp) {
	return new NextRequest(`http://localhost:3005${AUTH_ROUTE}`, {
		method: "POST",
		headers: {
			"x-forwarded-for": forwardedIp,
			"content-length": "0",
		},
	});
}

test("rate limits key on the forwarded client IP, not a shared bucket", async () => {
	const limitedIp = "203.0.113.10";
	const otherIp = "203.0.113.20";

	// Exhaust this client's auth bucket (limit is 5 per window).
	for (let i = 0; i < 5; i++) {
		const response = await proxy(authRequest(limitedIp));
		assert.notEqual(
			response.status,
			429,
			`request ${i + 1} from ${limitedIp} should be allowed`,
		);
	}

	const limited = await proxy(authRequest(limitedIp));
	assert.equal(limited.status, 429, `${limitedIp} should now be rate limited`);
	assert.equal(limited.headers.get("X-RateLimit-Limit"), "5");

	// A different client must not inherit the exhausted bucket. Before getClientIp
	// every request collapsed onto the literal key "unknown" and shared one bucket.
	const other = await proxy(authRequest(otherIp));
	assert.notEqual(
		other.status,
		429,
		`${otherIp} must not be rate limited by ${limitedIp}'s traffic`,
	);
});

test("falls back to x-real-ip when x-forwarded-for is absent", async () => {
	const realIp = "198.51.100.7";

	const first = await proxy(
		new NextRequest("http://localhost:3005/api/auth/register", {
			method: "POST",
			headers: { "x-real-ip": realIp, "content-length": "0" },
		}),
	);
	assert.notEqual(first.status, 429);

	for (let i = 0; i < 4; i++) {
		await proxy(
			new NextRequest("http://localhost:3005/api/auth/register", {
				method: "POST",
				headers: { "x-real-ip": realIp, "content-length": "0" },
			}),
		);
	}

	const limited = await proxy(
		new NextRequest("http://localhost:3005/api/auth/register", {
			method: "POST",
			headers: { "x-real-ip": realIp, "content-length": "0" },
		}),
	);
	assert.equal(limited.status, 429, `${realIp} should be rate limited`);
});
