/**
 * Umami First-Party Ingest Proxy
 *
 * POST /s/api/send|collect|record → upstream Umami /api/*.
 *
 * Why this exists: the tracker, web-vitals beacons, and replay batches would
 * otherwise POST directly to the upstream analytics host, which blocklists
 * (EasyPrivacy / uBlock / Brave) match as third-party. Same-origin ingest
 * survives those lists while keeping geo, browser stats, and CSP tightness.
 *
 * Security shape (load-bearing, do not loosen without review):
 * - Endpoint whitelist — never interpolate the raw route param into the
 *   upstream URL, or this becomes an open proxy to the analytics host.
 * - POST-only — every other method answers 405.
 * - Header hygiene — `cookie`, `authorization`, and `x-metrics-token` are
 *   never forwarded; only the analytics-relevant headers cross the boundary.
 * - `X-Forwarded-For` / `X-Real-IP` are preserved so Umami geolocates the
 *   visitor, not the Railway egress IP — unless TRUST_PROXY_HEADERS=false,
 *   in which case "unknown" crosses instead (same rule as proxy.js).
 * - 1 MB body cap enforced while streaming (a missing/lying Content-Length
 *   cannot force full buffering) + 5s upstream timeout bound abuse cost.
 * - `Cache-Control: no-store` on every response; upstream `Set-Cookie` is
 *   stripped and never reaches the browser.
 * - Fail-open 202 on upstream 5xx/timeout so analytics never fails the
 *   product flow — and never retry-storms a struggling upstream. The body
 *   is endpoint-aware: `record` answers `{ ok: false }` so replay batches
 *   are retained and retried, while `send`/`collect` answer `{ ok: true }`
 *   because those beacons have no retry path.
 *
 * Deliberately NOT rate-limited by proxy.js: that limiter keys on `/api/*`
 * paths and analytics beacons must never 429. The body cap, content-type
 * gate, and timeout are the abuse bounds here.
 */

import { createLogger } from "@usequark/quark-core/core";
import { NextResponse } from "next/server";
import { getUmamiUpstreamBase } from "@/lib/analytics/umami-config.js";
import { shouldTrustProxyHeaders } from "@/lib/proxy-auth.js";

const logger = createLogger("umami-proxy");

const ALLOWED_ENDPOINTS = new Set(["send", "collect", "record"]);
const MAX_BODY_BYTES = 1_000_000;
const UPSTREAM_TIMEOUT_MS = 5000;

function noStoreHeaders(extra = {}) {
	return { "Cache-Control": "no-store", ...extra };
}

function methodNotAllowed() {
	return NextResponse.json(
		{ error: "Method not allowed" },
		{ status: 405, headers: noStoreHeaders() },
	);
}

// Fail-open without losing replay data. Tracker (`send`) and web-vitals
// (`collect`) beacons are fire-and-forget with no retry path, so they keep
// `{ ok: true }` to avoid any client-side retry storm against a struggling
// upstream. Replay (`record`) has a restore/retry path keyed on
// `body.ok === false` in postReplayBatch: answering `ok: true` there would
// discard the batch, so record answers `ok: false` and the events are
// retained and retried.
function failOpenResponse(endpoint) {
	const body =
		endpoint === "record"
			? { ok: false, proxied: false, reason: "upstream_unavailable" }
			: { ok: true, proxied: false };
	return NextResponse.json(body, {
		status: 202,
		headers: noStoreHeaders(),
	});
}

function resolveClientIp(request) {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		const client = forwardedFor
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean)[0];
		if (client) return client;
	}

	return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Streams the request body under a running byte budget. The Content-Length
// pre-check above is only an early exit: a missing or lying header must not
// force full buffering of an unbounded body before the 413 fires.
async function readCappedBody(request) {
	if (!request.body) return { status: "empty" };

	const reader = request.body.getReader();
	const chunks = [];
	let total = 0;

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_BODY_BYTES) {
				await reader.cancel().catch(() => {});
				return { status: "too-large" };
			}
			chunks.push(value);
		}
	} catch {
		return { status: "unreadable" };
	}

	if (!total) return { status: "empty" };

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return { status: "ok", bytes };
}

export async function POST(request, { params } = {}) {
	const resolvedParams = params ? await params : {};
	const endpoint = resolvedParams?.endpoint;

	if (!ALLOWED_ENDPOINTS.has(endpoint)) {
		return NextResponse.json(
			{ error: "Not found" },
			{ status: 404, headers: noStoreHeaders() },
		);
	}

	const contentType =
		request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
		"";
	if (contentType !== "application/json") {
		return NextResponse.json(
			{ error: "Unsupported media type" },
			{ status: 415, headers: noStoreHeaders() },
		);
	}

	const contentLength = request.headers.get("content-length");
	if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
		return NextResponse.json(
			{ error: "Payload too large" },
			{ status: 413, headers: noStoreHeaders() },
		);
	}

	let body;
	try {
		body = await readCappedBody(request);
	} catch {
		return NextResponse.json(
			{ error: "Unreadable request body" },
			{ status: 400, headers: noStoreHeaders() },
		);
	}

	if (body.status === "too-large") {
		return NextResponse.json(
			{ error: "Payload too large" },
			{ status: 413, headers: noStoreHeaders() },
		);
	}

	if (body.status !== "ok") {
		return NextResponse.json(
			{
				error:
					body.status === "empty" ? "Empty body" : "Unreadable request body",
			},
			{ status: 400, headers: noStoreHeaders() },
		);
	}

	const upstreamBase = getUmamiUpstreamBase(process.env);
	if (!upstreamBase) {
		return failOpenResponse(endpoint);
	}

	// Honor the same proxy-header trust setting as proxy.js: with
	// TRUST_PROXY_HEADERS=false the app is directly reachable, the headers
	// are attacker-controlled, and forwarding them would poison Umami geo.
	// "unknown" (never client bytes) crosses the boundary instead.
	const trustProxyHeaders = shouldTrustProxyHeaders();
	const incomingForwardedFor = trustProxyHeaders
		? request.headers.get("x-forwarded-for")
		: null;
	const clientIp = trustProxyHeaders ? resolveClientIp(request) : "unknown";
	const forwardedFor = incomingForwardedFor?.trim()
		? incomingForwardedFor
		: clientIp;

	const forwardHeaders = {
		"Content-Type": "application/json",
		"X-Forwarded-For": forwardedFor,
		"X-Real-IP": trustProxyHeaders
			? request.headers.get("x-real-ip")?.trim() || clientIp
			: clientIp,
	};

	const userAgent = request.headers.get("user-agent");
	if (userAgent) forwardHeaders["User-Agent"] = userAgent;

	const acceptLanguage = request.headers.get("accept-language");
	if (acceptLanguage) forwardHeaders["Accept-Language"] = acceptLanguage;

	const umamiCache = request.headers.get("x-umami-cache");
	if (umamiCache) forwardHeaders["x-umami-cache"] = umamiCache;

	let upstreamResponse;
	try {
		upstreamResponse = await fetch(`${upstreamBase}/api/${endpoint}`, {
			method: "POST",
			body: body.bytes,
			headers: forwardHeaders,
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (error) {
		logger.warn("Umami ingest proxy upstream unreachable", {
			endpoint,
			message: error?.message ?? String(error),
		});
		return failOpenResponse(endpoint);
	}

	if (upstreamResponse.status >= 500) {
		logger.warn("Umami ingest proxy upstream error", {
			endpoint,
			status: upstreamResponse.status,
		});
		return failOpenResponse(endpoint);
	}

	let responseBody;
	try {
		responseBody = await upstreamResponse.arrayBuffer();
	} catch (error) {
		logger.warn("Umami ingest proxy upstream body unreadable", {
			endpoint,
			message: error?.message ?? String(error),
		});
		return failOpenResponse(endpoint);
	}

	const responseHeaders = noStoreHeaders();
	const upstreamContentType = upstreamResponse.headers.get("content-type");
	if (upstreamContentType) {
		responseHeaders["Content-Type"] = upstreamContentType;
	}

	// Never pass upstream Set-Cookie through to the browser.
	return new NextResponse(responseBody, {
		status: upstreamResponse.status,
		headers: responseHeaders,
	});
}

export function GET() {
	return methodNotAllowed();
}

export function PUT() {
	return methodNotAllowed();
}

export function PATCH() {
	return methodNotAllowed();
}

export function DELETE() {
	return methodNotAllowed();
}

export function HEAD() {
	return methodNotAllowed();
}

export function OPTIONS() {
	return methodNotAllowed();
}
