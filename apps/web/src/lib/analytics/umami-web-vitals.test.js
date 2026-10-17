import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { dispatchMetric } from "./umami-web-vitals.js";

const WEBSITE_ID = "133660ed-e51c-4ed9-84aa-c86654460cae";

let savedEnv;

beforeEach(() => {
	savedEnv = { ...process.env };
	process.env.NEXT_PUBLIC_UMAMI_URL = "https://stats.example.com";
	process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = WEBSITE_ID;
	delete globalThis.window;
	delete globalThis.navigator;
});

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in savedEnv)) delete process.env[key];
	}
	Object.assign(process.env, savedEnv);
	delete globalThis.window;
	delete globalThis.navigator;
});

function stubBrowser() {
	const seen = {};
	globalThis.window = {
		location: {
			href: "https://app.example.com/pricing?ref=newsletter#plans",
			hostname: "app.example.com",
		},
	};
	globalThis.navigator = {
		sendBeacon: (url, blob) => {
			seen.beacon = { url, blob };
			return true;
		},
	};
	return seen;
}

test("dispatchMetric posts a send-schema custom event to the first-party endpoint", async () => {
	const seen = stubBrowser();

	dispatchMetric({ name: "LCP", value: 1234.5678, rating: "good" });

	assert.equal(seen.beacon.url, "/s/api/send");
	const body = JSON.parse(await seen.beacon.blob.text());
	assert.equal(body.type, "event");
	assert.equal(body.payload.website, WEBSITE_ID);
	// Umami derives custom-event-ness server-side from `name` and persists
	// `data`. The old `event_name`/`event_type`/`event_data` keys were
	// silently ignored upstream — assert they are gone.
	assert.equal(body.payload.name, "cwv");
	assert.deepEqual(body.payload.data, {
		metric_name: "LCP",
		metric_value: 1234.568,
		metric_rating: "good",
		navigation_type: "navigate",
	});
	assert.equal(body.payload.url, "/pricing");
	assert.equal(body.payload.hostname, "app.example.com");
	assert.ok(!("event_name" in body.payload));
	assert.ok(!("event_type" in body.payload));
	assert.ok(!("event_data" in body.payload));
});

test("dispatchMetric falls back to fetch with keepalive without sendBeacon", async () => {
	stubBrowser();
	delete globalThis.navigator.sendBeacon;

	let seen;
	globalThis.fetch = async (url, options) => {
		seen = { url, options };
		return { ok: true };
	};

	dispatchMetric({ name: "TTFB", value: 120, rating: "good" });

	assert.equal(seen.url, "/s/api/send");
	assert.equal(seen.options.method, "POST");
	assert.equal(seen.options.keepalive, true);
	assert.equal(seen.options.credentials, "omit");

	delete globalThis.fetch;
});

test("dispatchMetric no-ops when analytics is disabled", () => {
	delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
	const seen = stubBrowser();

	dispatchMetric({ name: "LCP", value: 1, rating: "good" });

	assert.equal(seen.beacon, undefined);
});
