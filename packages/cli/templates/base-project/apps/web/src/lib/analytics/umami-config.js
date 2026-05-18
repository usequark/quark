const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const UMAMI_WEBSITE_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUmamiUrl(value) {
	if (typeof value !== "string") return "";

	const trimmed = value.trim();
	if (!trimmed) return "";

	let parsedUrl;
	try {
		parsedUrl = new URL(trimmed);
	} catch {
		return "";
	}

	if (!["http:", "https:"].includes(parsedUrl.protocol)) {
		return "";
	}

	parsedUrl.search = "";
	parsedUrl.hash = "";
	parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

	const normalized = parsedUrl.toString();
	return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function getUmamiOrigin(value) {
	const normalizedUrl = normalizeUmamiUrl(value);
	if (!normalizedUrl) return "";

	return new URL(normalizedUrl).origin;
}

export function getUmamiDnsPrefetchHref(value) {
	const normalizedUrl = normalizeUmamiUrl(value);
	if (!normalizedUrl) return "";

	return `//${new URL(normalizedUrl).host}`;
}

export function getUmamiScriptUrl(value) {
	const normalizedUrl = normalizeUmamiUrl(value);
	if (!normalizedUrl) return "";

	return `${normalizedUrl}/script.js`;
}

export function parseUmamiBooleanFlag(value) {
	if (typeof value !== "string") return false;
	return TRUE_VALUES.has(value.trim().toLowerCase());
}

export function isUmamiWebsiteId(value) {
	if (typeof value !== "string") return false;
	return UMAMI_WEBSITE_ID_PATTERN.test(value.trim());
}

export function getUmamiConfig(env = process.env) {
	const url = normalizeUmamiUrl(env.NEXT_PUBLIC_UMAMI_URL);
	const rawWebsiteId =
		typeof env.NEXT_PUBLIC_UMAMI_WEBSITE_ID === "string"
			? env.NEXT_PUBLIC_UMAMI_WEBSITE_ID.trim()
			: "";
	const websiteId = isUmamiWebsiteId(rawWebsiteId) ? rawWebsiteId : "";
	const enabled = Boolean(url && websiteId);

	return {
		url,
		origin: getUmamiOrigin(url),
		dnsPrefetchHref: getUmamiDnsPrefetchHref(url),
		scriptUrl: getUmamiScriptUrl(url),
		websiteId,
		enabled,
		replayEnabled:
			enabled && parseUmamiBooleanFlag(env.NEXT_PUBLIC_UMAMI_REPLAY_ENABLED),
	};
}

export function getUmamiCspOrigins(env = process.env) {
	const config = getUmamiConfig(env);
	if (!config.enabled || !config.origin) {
		return {
			scriptSrc: [],
			connectSrc: [],
		};
	}

	return {
		scriptSrc: [config.origin],
		connectSrc: [config.origin],
	};
}
