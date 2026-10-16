import assert from "node:assert/strict";
import test from "node:test";

import {
	getUmamiClientConfig,
	getUmamiConfig,
	getUmamiCspOrigins,
	isUmamiWebsiteId,
	normalizeUmamiUrl,
	parseUmamiBooleanFlag,
	readPublicEnv,
} from "./umami-config.js";

test("normalizeUmamiUrl trims whitespace and drops query, hash, and trailing slash", () => {
	assert.equal(
		normalizeUmamiUrl(" https://stats.example.com/collect/?foo=bar#hash "),
		"https://stats.example.com/collect",
	);
});

test("normalizeUmamiUrl rejects invalid or unsupported URLs", () => {
	assert.equal(normalizeUmamiUrl(""), "");
	assert.equal(normalizeUmamiUrl("not-a-url"), "");
	assert.equal(normalizeUmamiUrl("ftp://stats.example.com"), "");
});

test("getUmamiConfig enables analytics only when URL and website ID are present", () => {
	assert.deepEqual(
		getUmamiConfig({
			NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com/",
			NEXT_PUBLIC_UMAMI_WEBSITE_ID: "133660ed-e51c-4ed9-84aa-c86654460cae",
			NEXT_PUBLIC_UMAMI_REPLAY_ENABLED: "true",
		}),
		{
			url: "https://stats.example.com",
			origin: "https://stats.example.com",
			dnsPrefetchHref: "//stats.example.com",
			scriptUrl: "https://stats.example.com/script.js",
			websiteId: "133660ed-e51c-4ed9-84aa-c86654460cae",
			enabled: true,
			replayEnabled: true,
			proxyBase: "/s",
			proxyScriptUrl: "/s/script.js",
			proxyHostUrl: "/s",
			proxySendUrl: "/s/api/send",
			proxyCollectUrl: "/s/api/collect",
			proxyRecordUrl: "/s/api/record",
		},
	);
});

test("isUmamiWebsiteId only accepts UUID values", () => {
	assert.equal(isUmamiWebsiteId("133660ed-e51c-4ed9-84aa-c86654460cae"), true);
	assert.equal(isUmamiWebsiteId("website_123"), false);
	assert.equal(isUmamiWebsiteId(undefined), false);
});

test("getUmamiConfig disables analytics when the website ID is invalid", () => {
	assert.deepEqual(
		getUmamiConfig({
			NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
			NEXT_PUBLIC_UMAMI_WEBSITE_ID: "website_123",
			NEXT_PUBLIC_UMAMI_REPLAY_ENABLED: "true",
		}),
		{
			url: "https://stats.example.com",
			origin: "https://stats.example.com",
			dnsPrefetchHref: "//stats.example.com",
			scriptUrl: "https://stats.example.com/script.js",
			websiteId: "",
			enabled: false,
			replayEnabled: false,
			proxyBase: "",
			proxyScriptUrl: "",
			proxyHostUrl: "",
			proxySendUrl: "",
			proxyCollectUrl: "",
			proxyRecordUrl: "",
		},
	);
});

test("getUmamiConfig disables replay when the analytics contract is incomplete", () => {
	assert.deepEqual(
		getUmamiConfig({
			NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
			NEXT_PUBLIC_UMAMI_REPLAY_ENABLED: "true",
		}),
		{
			url: "https://stats.example.com",
			origin: "https://stats.example.com",
			dnsPrefetchHref: "//stats.example.com",
			scriptUrl: "https://stats.example.com/script.js",
			websiteId: "",
			enabled: false,
			replayEnabled: false,
			proxyBase: "",
			proxyScriptUrl: "",
			proxyHostUrl: "",
			proxySendUrl: "",
			proxyCollectUrl: "",
			proxyRecordUrl: "",
		},
	);
});

test("parseUmamiBooleanFlag only accepts explicit truthy values", () => {
	assert.equal(parseUmamiBooleanFlag("true"), true);
	assert.equal(parseUmamiBooleanFlag("On"), true);
	assert.equal(parseUmamiBooleanFlag("false"), false);
	assert.equal(parseUmamiBooleanFlag(undefined), false);
});

test("getUmamiConfig exposes first-party proxy URLs and prefers server-only upstream", () => {
	const config = getUmamiConfig({
		NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: "133660ed-e51c-4ed9-84aa-c86654460cae",
	});

	assert.equal(config.proxyScriptUrl, "/s/script.js");
	assert.equal(config.proxyHostUrl, "/s");
	assert.equal(config.proxyCollectUrl, "/s/api/collect");
	assert.equal(config.proxyRecordUrl, "/s/api/record");
	assert.ok(!config.proxyScriptUrl.includes("stats.example.com"));

	const overridden = getUmamiConfig({
		UMAMI_UPSTREAM_URL: "https://upstream.example.com",
		NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: "133660ed-e51c-4ed9-84aa-c86654460cae",
	});

	assert.equal(overridden.url, "https://upstream.example.com");
	assert.equal(overridden.proxyScriptUrl, "/s/script.js");
});

test("getUmamiClientConfig carries no upstream URL, origin, or script URL", () => {
	const config = getUmamiClientConfig({
		NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: "133660ed-e51c-4ed9-84aa-c86654460cae",
		NEXT_PUBLIC_UMAMI_REPLAY_ENABLED: "true",
	});

	assert.deepEqual(config, {
		websiteId: "133660ed-e51c-4ed9-84aa-c86654460cae",
		enabled: true,
		replayEnabled: true,
		proxyBase: "/s",
		proxyScriptUrl: "/s/script.js",
		proxyHostUrl: "/s",
		proxySendUrl: "/s/api/send",
		proxyCollectUrl: "/s/api/collect",
		proxyRecordUrl: "/s/api/record",
	});
	assert.ok(!("url" in config));
	assert.ok(!("origin" in config));
	assert.ok(!("scriptUrl" in config));
	assert.ok(!JSON.stringify(config).includes("stats.example.com"));
});

test("getUmamiClientConfig enables on website ID alone and disables cleanly", () => {
	const enabled = getUmamiClientConfig({
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: "133660ed-e51c-4ed9-84aa-c86654460cae",
	});

	assert.equal(enabled.enabled, true);
	assert.equal(enabled.proxyCollectUrl, "/s/api/collect");

	const disabled = getUmamiClientConfig({
		NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
	});

	assert.deepEqual(disabled, {
		websiteId: "",
		enabled: false,
		replayEnabled: false,
		proxyBase: "",
		proxyScriptUrl: "",
		proxyHostUrl: "",
		proxySendUrl: "",
		proxyCollectUrl: "",
		proxyRecordUrl: "",
	});
});

test("readPublicEnv degrades to {} when process is absent (browser shape)", () => {
	const realProcess = globalThis.process;
	globalThis.process = undefined;
	try {
		assert.deepEqual(readPublicEnv(), {});
		// No-arg client config must disable cleanly, never throw: bare
		// `process.env` defaults threw ReferenceError in every browser,
		// killing track(), web-vitals, and replay client-side.
		const config = getUmamiClientConfig();
		assert.equal(config.enabled, false);
		assert.equal(config.proxyCollectUrl, "");
	} finally {
		globalThis.process = realProcess;
	}
});

test("getUmamiCspOrigins stays self-only in proxy mode", () => {
	assert.deepEqual(
		getUmamiCspOrigins({
			NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
			NEXT_PUBLIC_UMAMI_WEBSITE_ID: "133660ed-e51c-4ed9-84aa-c86654460cae",
		}),
		{
			scriptSrc: [],
			connectSrc: [],
		},
	);

	assert.deepEqual(
		getUmamiCspOrigins({
			NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
		}),
		{
			scriptSrc: [],
			connectSrc: [],
		},
	);
});
