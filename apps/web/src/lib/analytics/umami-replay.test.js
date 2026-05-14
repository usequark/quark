import assert from "node:assert/strict";
import test from "node:test";

import {
	buildReplayEndpoint,
	createReplayBuffer,
	postReplayBatch,
	resolveUmamiSessionCache,
	shouldSampleReplay,
	waitForUmamiSessionCache,
} from "./umami-replay.js";

test("buildReplayEndpoint uses the normalized Umami URL", () => {
	assert.equal(
		buildReplayEndpoint({
			NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com/",
		}),
		"https://stats.example.com/api/record",
	);
});

test("shouldSampleReplay respects sample-rate bounds", () => {
	assert.equal(shouldSampleReplay(0.1, 0.15), true);
	assert.equal(shouldSampleReplay(0.2, 0.15), false);
	assert.equal(shouldSampleReplay(0.2, 1), true);
	assert.equal(shouldSampleReplay(0.2, 0), false);
});

test("createReplayBuffer drains and restores without losing order", () => {
	const buffer = createReplayBuffer();

	buffer.push({ id: 1 });
	buffer.push({ id: 2 });
	const drained = buffer.drain();

	assert.deepEqual(drained, [{ id: 1 }, { id: 2 }]);
	assert.equal(buffer.size(), 0);

	buffer.push({ id: 3 });
	buffer.restore(drained);

	assert.deepEqual(buffer.drain(), [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test("waitForUmamiSessionCache resolves once the tracker session cache exists", async () => {
	let attempts = 0;

	const cache = await waitForUmamiSessionCache({
		getUmami: () => ({
			getSession: () => ({
				cache: attempts++ >= 2 ? "session-cache" : "",
			}),
		}),
		pollIntervalMs: 0,
		maxAttempts: 5,
	});

	assert.equal(cache, "session-cache");
});

test("resolveUmamiSessionCache prefers the live tracker session cache", () => {
	const cache = resolveUmamiSessionCache({
		cache: "stale-cache",
		getUmami: () => ({
			getSession: () => ({ cache: "fresh-cache" }),
		}),
	});

	assert.equal(cache, "fresh-cache");
});

test("postReplayBatch sends the official Umami replay payload shape", async () => {
	let request;

	const sent = await postReplayBatch({
		endpoint: "https://stats.example.com/api/record",
		cache: "cache-token",
		websiteId: "site_123",
		events: [{ timestamp: 1, type: 4 }],
		timestamp: 123,
		useKeepalive: true,
		fetchImpl: async (endpoint, options) => {
			request = { endpoint, options };
			return { ok: true };
		},
	});

	assert.equal(sent, true);
	assert.equal(request.endpoint, "https://stats.example.com/api/record");
	assert.equal(request.options.keepalive, true);
	assert.equal(request.options.credentials, "omit");
	assert.equal(request.options.headers["x-umami-cache"], "cache-token");
	assert.deepEqual(JSON.parse(request.options.body), {
		type: "record",
		payload: {
			website: "site_123",
			events: [{ timestamp: 1, type: 4 }],
			timestamp: 123,
		},
	});
});

test("postReplayBatch refreshes the Umami cache before uploading", async () => {
	let request;

	await postReplayBatch({
		endpoint: "https://stats.example.com/api/record",
		cache: "stale-cache",
		websiteId: "site_123",
		events: [{ timestamp: 1, type: 4 }],
		getUmami: () => ({
			getSession: () => ({ cache: "fresh-cache" }),
		}),
		fetchImpl: async (endpoint, options) => {
			request = { endpoint, options };
			return { ok: true };
		},
	});

	assert.equal(request.options.headers["x-umami-cache"], "fresh-cache");
});

test("postReplayBatch disables keepalive for oversized unload payloads", async () => {
	let request;

	await postReplayBatch({
		endpoint: "https://stats.example.com/api/record",
		cache: "cache-token",
		websiteId: "site_123",
		events: [{ timestamp: 1, text: "x".repeat(70000) }],
		useKeepalive: true,
		fetchImpl: async (endpoint, options) => {
			request = { endpoint, options };
			return { ok: true };
		},
	});

	assert.equal(request.options.keepalive, false);
});
