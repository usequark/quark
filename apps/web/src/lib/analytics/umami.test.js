import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { identify, isUmamiEnabled, track } from "./umami.js";

const WEBSITE_ID = "133660ed-e51c-4ed9-84aa-c86654460cae";

let savedEnv;

beforeEach(() => {
	savedEnv = { ...process.env };
	delete process.env.NEXT_PUBLIC_UMAMI_URL;
	delete process.env.UMAMI_UPSTREAM_URL;
	delete process.env.UMAMI_URL;
	delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
	delete process.env.NEXT_PUBLIC_UMAMI_REPLAY_ENABLED;
	delete globalThis.window;
});

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in savedEnv)) delete process.env[key];
	}
	Object.assign(process.env, savedEnv);
	delete globalThis.window;
});

function stubWindow() {
	const calls = [];
	globalThis.window = {
		umami: {
			track: (...args) => {
				calls.push(args);
			},
			identify: (data) => {
				calls.push([data]);
			},
		},
	};
	return calls;
}

test("track() forwards events when only a website ID is configured", () => {
	process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = WEBSITE_ID;
	const calls = stubWindow();

	assert.equal(track("signup", { plan: "pro" }), true);
	assert.deepEqual(calls, [["signup", { plan: "pro" }]]);
	assert.equal(isUmamiEnabled(), true);
});

test("track() and identify() stay live under a server-only upstream", () => {
	// No NEXT_PUBLIC_UMAMI_URL: the analytics host is server-only, but the
	// first-party tracker still loads and helpers must not go dark.
	process.env.UMAMI_UPSTREAM_URL = "https://stats.example.com";
	process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = WEBSITE_ID;
	const calls = stubWindow();

	assert.equal(track("signup"), true);
	assert.equal(identify({ userId: "123" }), true);
	assert.equal(calls.length, 2);
});

test("track() no-ops without a website ID, even with the tracker present", () => {
	stubWindow();

	assert.equal(track("signup"), false);
	assert.equal(identify({ userId: "123" }), false);
	assert.equal(isUmamiEnabled(), false);
});

test("track() no-ops without a browser window", () => {
	process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = WEBSITE_ID;

	assert.equal(track("signup"), false);
});
