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

// ─── First-party proxy ───────────────────────────────────────────────────────
// The tracker, web-vitals beacons, and replay batches are served through
// same-origin URLs so blocklists never see the upstream analytics host.
// Base `/s` carries no `umami|analytics|track|stats|collect|send` token;
// the `/api/*` suffix under it preserves the tracker's `data-host-url`
// convention (`data-host-url="/s"` → POST `/s/api/send` with zero forks).
export const UMAMI_PROXY_BASE = "/s";
export const UMAMI_PROXY_SCRIPT_PATH = "/s/script.js";
export const UMAMI_PROXY_HOST_URL = "/s";
export const UMAMI_PROXY_SEND_PATH = "/s/api/send";
// Legacy alias for pre-v2 Umami (whose ingest lived at /api/collect). Nothing
// in the scaffold posts here anymore — web-vitals uses the send schema — but
// the pinned path costs nothing to keep forwarding. Do not remove without
// checking supported upstream versions.
export const UMAMI_PROXY_COLLECT_PATH = "/s/api/collect";
export const UMAMI_PROXY_RECORD_PATH = "/s/api/record";

// Server-side upstream preference: an operator that wants the analytics host
// out of the client bundle entirely sets UMAMI_UPSTREAM_URL (or UMAMI_URL)
// and the rewrite/handler destination follows it. NEXT_PUBLIC_UMAMI_URL
// remains the default so existing deployments keep working with no new vars.
export function getUmamiUpstreamBase(env = process.env) {
	const candidates = [
		env.UMAMI_UPSTREAM_URL,
		env.UMAMI_URL,
		env.NEXT_PUBLIC_UMAMI_URL,
	];

	for (const candidate of candidates) {
		const normalized = normalizeUmamiUrl(candidate);
		if (normalized) return normalized;
	}

	return "";
}

// Default env for browser-safe readers. Each NEXT_PUBLIC_* access MUST stay
// a literal member expression: Next.js statically inlines those literals in
// client bundles, where bare `process` does not exist — a whole-`process.env`
// default throws ReferenceError in every browser, which previously killed
// track(), web-vitals, and replay client-side. Do not refactor this into a
// `process.env` passthrough. Exported for tests (the no-process fallback).
export function readPublicEnv() {
	try {
		return {
			NEXT_PUBLIC_UMAMI_URL: process.env.NEXT_PUBLIC_UMAMI_URL,
			NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
			NEXT_PUBLIC_UMAMI_REPLAY_ENABLED:
				process.env.NEXT_PUBLIC_UMAMI_REPLAY_ENABLED,
		};
	} catch {
		return {};
	}
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
	const url = getUmamiUpstreamBase(env);
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
		// First-party proxy URLs. Empty when analytics is disabled so
		// callers can gate on `enabled` alone.
		proxyBase: enabled ? UMAMI_PROXY_BASE : "",
		proxyScriptUrl: enabled ? UMAMI_PROXY_SCRIPT_PATH : "",
		proxyHostUrl: enabled ? UMAMI_PROXY_HOST_URL : "",
		proxySendUrl: enabled ? UMAMI_PROXY_SEND_PATH : "",
		proxyCollectUrl: enabled ? UMAMI_PROXY_COLLECT_PATH : "",
		proxyRecordUrl: enabled ? UMAMI_PROXY_RECORD_PATH : "",
	};
}

// Client-safe config. Contains no upstream URL, origin, or script URL — only
// the website ID, gates, and static first-party proxy paths. Browser code
// must use this (never getUmamiConfig) so the analytics host cannot end up
// in client bundles. `enabled` needs only a valid website ID because every
// client surface is same-origin; the server layout keeps the upstream-aware
// gate so a missing upstream never emits a 404 script tag.
//
// The default env is readPublicEnv(), not process.env: bare `process` does
// not exist in browsers, so a process.env default throws on every no-arg
// browser call.
export function getUmamiClientConfig(env = readPublicEnv()) {
	const rawWebsiteId =
		typeof env.NEXT_PUBLIC_UMAMI_WEBSITE_ID === "string"
			? env.NEXT_PUBLIC_UMAMI_WEBSITE_ID.trim()
			: "";
	const websiteId = isUmamiWebsiteId(rawWebsiteId) ? rawWebsiteId : "";
	const enabled = Boolean(websiteId);

	return {
		websiteId,
		enabled,
		replayEnabled:
			enabled && parseUmamiBooleanFlag(env.NEXT_PUBLIC_UMAMI_REPLAY_ENABLED),
		proxyBase: enabled ? UMAMI_PROXY_BASE : "",
		proxyScriptUrl: enabled ? UMAMI_PROXY_SCRIPT_PATH : "",
		proxyHostUrl: enabled ? UMAMI_PROXY_HOST_URL : "",
		proxySendUrl: enabled ? UMAMI_PROXY_SEND_PATH : "",
		proxyCollectUrl: enabled ? UMAMI_PROXY_COLLECT_PATH : "",
		proxyRecordUrl: enabled ? UMAMI_PROXY_RECORD_PATH : "",
	};
}

export function getUmamiCspOrigins() {
	// Proxy mode is the default path when analytics is enabled: tracker and
	// beacons are same-origin, so CSP stays `'self'`-only and never names
	// the upstream analytics host.
	return {
		scriptSrc: [],
		connectSrc: [],
	};
}
