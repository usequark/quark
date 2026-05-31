import assert from "node:assert/strict";
import test from "node:test";

import {
	buildCampaignUrl,
	getUmamiEmailPixelHtml,
	getUmamiPixelProps,
	resolveUmamiLinkHref,
} from "./umami-marketing.js";

test("buildCampaignUrl appends supported UTM params to relative URLs", () => {
	assert.equal(
		buildCampaignUrl("/pricing?plan=pro#faq", {
			utm_source: "newsletter",
			utm_medium: "email",
			utm_campaign: "launch",
			ignored: "value",
		}),
		"/pricing?plan=pro&utm_source=newsletter&utm_medium=email&utm_campaign=launch#faq",
	);
});

test("buildCampaignUrl returns an absolute URL when given one", () => {
	assert.equal(
		buildCampaignUrl("https://app.example.com/contact", {
			utm_source: "linkedin",
			utm_medium: "social",
		}),
		"https://app.example.com/contact?utm_source=linkedin&utm_medium=social",
	);
});

test("resolveUmamiLinkHref prefers a valid dashboard-generated tracking link", () => {
	assert.equal(
		resolveUmamiLinkHref({
			href: "https://app.example.com/pricing",
			trackingHref: "https://stats.example.com/l/abc123",
		}),
		"https://stats.example.com/l/abc123",
	);

	assert.equal(
		resolveUmamiLinkHref({
			href: "https://app.example.com/pricing",
			trackingHref: "javascript:alert(1)",
		}),
		"https://app.example.com/pricing",
	);

	assert.equal(
		resolveUmamiLinkHref({
			href: "/pricing?plan=pro#faq",
			trackingHref: "javascript:alert(1)",
		}),
		"/pricing?plan=pro#faq",
	);

	assert.equal(
		resolveUmamiLinkHref({
			href: "javascript:alert(1)",
			trackingHref: "",
		}),
		"",
	);
});

test("getUmamiPixelProps returns safe hidden-image props for valid pixel URLs", () => {
	assert.deepEqual(getUmamiPixelProps("javascript:alert(1)"), null);

	assert.deepEqual(
		getUmamiPixelProps("https://stats.example.com/pixel/abc123"),
		{
			src: "https://stats.example.com/pixel/abc123",
			alt: "",
			width: 1,
			height: 1,
			decoding: "async",
			"aria-hidden": "true",
			referrerPolicy: "strict-origin-when-cross-origin",
			style: {
				border: 0,
				display: "none",
				height: "1px",
				overflow: "hidden",
				width: "1px",
			},
		},
	);
});

test("getUmamiEmailPixelHtml returns dormant HTML for valid pixel URLs only", () => {
	assert.equal(getUmamiEmailPixelHtml(""), "");
	assert.equal(getUmamiEmailPixelHtml("ftp://stats.example.com/pixel"), "");

	assert.equal(
		getUmamiEmailPixelHtml(
			"https://stats.example.com/pixel/abc123?campaign=launch",
		),
		'<img src="https://stats.example.com/pixel/abc123?campaign=launch" alt="" width="1" height="1" decoding="async" aria-hidden="true" style="display:none !important;width:1px;height:1px;overflow:hidden;border:0;" />',
	);
});
