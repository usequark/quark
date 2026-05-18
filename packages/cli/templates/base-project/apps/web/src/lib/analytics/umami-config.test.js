import assert from "node:assert/strict";
import test from "node:test";

import {
	getUmamiConfig,
	getUmamiCspOrigins,
	isUmamiWebsiteId,
	normalizeUmamiUrl,
	parseUmamiBooleanFlag,
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
		},
	);
});

test("parseUmamiBooleanFlag only accepts explicit truthy values", () => {
	assert.equal(parseUmamiBooleanFlag("true"), true);
	assert.equal(parseUmamiBooleanFlag("On"), true);
	assert.equal(parseUmamiBooleanFlag("false"), false);
	assert.equal(parseUmamiBooleanFlag(undefined), false);
});

test("getUmamiCspOrigins only emits allowlists when analytics is enabled", () => {
	assert.deepEqual(
		getUmamiCspOrigins({
			NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com",
			NEXT_PUBLIC_UMAMI_WEBSITE_ID: "133660ed-e51c-4ed9-84aa-c86654460cae",
		}),
		{
			scriptSrc: ["https://stats.example.com"],
			connectSrc: ["https://stats.example.com"],
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
