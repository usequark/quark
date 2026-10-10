import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server.js";

import { proxy } from "./proxy.redis.js";

// This file is the documented drop-in replacement for proxy.js in multi-instance
// deployments ("Replace proxy.js with this file"), and proxy.test.js never touches
// it — so without this test the healthcheck exemption could silently lapse here
// and nobody would find out until a platform probe restarted a container.

test("never rate limits /api/health", async () => {
	const healthIp = "203.0.113.40";
	const healthRequest = () =>
		new NextRequest("http://localhost:3005/api/health", {
			headers: { "x-forwarded-for": healthIp },
		});

	// The `api` bucket allows 100 per window. Burning through it and then some
	// must not stop the healthcheck: a probe that gets a 429 reads as unhealthy
	// and makes the orchestrator restart the container, which refills the bucket
	// and repeats.
	for (let i = 0; i < 110; i++) {
		const response = await proxy(healthRequest());
		assert.notEqual(response.status, 429, `probe ${i + 1} was rate limited`);
		assert.equal(
			response.headers.get("X-RateLimit-Limit"),
			null,
			`probe ${i + 1} carried rate-limit headers, so it entered the bucket`,
		);
	}
});

test("still rate limits non-exempt API routes", async () => {
	const ip = "203.0.113.41";
	const apiRequest = () =>
		new NextRequest("http://localhost:3005/api/users", {
			headers: { "x-forwarded-for": ip },
		});

	const limited = await proxy(apiRequest());
	assert.notEqual(limited.status, 429);
	assert.equal(limited.headers.get("X-RateLimit-Limit"), "100");

	// The exemption above must not have made this file limit nothing: exhaust
	// the `api` bucket and confirm the 429 arrives on the request after last.
	for (let i = 1; i < 100; i++) {
		await proxy(apiRequest());
	}

	const exhausted = await proxy(apiRequest());
	assert.equal(exhausted.status, 429, "api bucket should be exhausted");
});
