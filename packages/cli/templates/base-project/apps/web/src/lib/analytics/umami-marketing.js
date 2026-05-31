const CAMPAIGN_PARAM_NAMES = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
];

const RELATIVE_URL_BASE = "https://quark.invalid";

function getTrimmedString(value) {
	return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function normalizeAbsoluteHttpUrl(value) {
	const trimmed = getTrimmedString(value);
	if (!trimmed) return "";

	try {
		const parsed = new URL(trimmed);
		if (!["http:", "https:"].includes(parsed.protocol)) {
			return "";
		}

		return parsed.toString();
	} catch {
		return "";
	}
}

function parseCampaignUrl(value) {
	const trimmed = getTrimmedString(value);
	if (!trimmed) return null;

	const absoluteUrl = normalizeAbsoluteHttpUrl(trimmed);
	if (absoluteUrl) {
		return {
			isAbsolute: true,
			url: new URL(absoluteUrl),
		};
	}

	if (
		trimmed.startsWith("/") ||
		trimmed.startsWith("?") ||
		trimmed.startsWith("#")
	) {
		return {
			isAbsolute: false,
			url: new URL(trimmed, RELATIVE_URL_BASE),
		};
	}

	return null;
}

export function buildCampaignUrl(href, campaign = {}) {
	const parsed = parseCampaignUrl(href);
	if (!parsed) return "";

	for (const [key, value] of Object.entries(campaign)) {
		if (!CAMPAIGN_PARAM_NAMES.includes(key)) continue;

		const trimmed = getTrimmedString(value);
		if (!trimmed) continue;

		parsed.url.searchParams.set(key, trimmed);
	}

	if (parsed.isAbsolute) {
		return parsed.url.toString();
	}

	return `${parsed.url.pathname}${parsed.url.search}${parsed.url.hash}`;
}

function normalizeLinkHref(value) {
	const parsed = parseCampaignUrl(value);
	if (!parsed) return "";

	if (parsed.isAbsolute) {
		return parsed.url.toString();
	}

	return `${parsed.url.pathname}${parsed.url.search}${parsed.url.hash}`;
}

export function resolveUmamiLinkHref({ href = "", trackingHref = "" } = {}) {
	return normalizeAbsoluteHttpUrl(trackingHref) || normalizeLinkHref(href);
}

export function getUmamiPixelProps(
	pixelUrl,
	{ alt = "", width = 1, height = 1 } = {},
) {
	const normalizedPixelUrl = normalizeAbsoluteHttpUrl(pixelUrl);
	if (!normalizedPixelUrl) return null;

	return {
		src: normalizedPixelUrl,
		alt: getTrimmedString(alt),
		width,
		height,
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
	};
}

export function getUmamiEmailPixelHtml(pixelUrl) {
	const normalizedPixelUrl = normalizeAbsoluteHttpUrl(pixelUrl);
	if (!normalizedPixelUrl) return "";

	return `<img src="${escapeHtml(normalizedPixelUrl)}" alt="" width="1" height="1" decoding="async" aria-hidden="true" style="display:none !important;width:1px;height:1px;overflow:hidden;border:0;" />`;
}
