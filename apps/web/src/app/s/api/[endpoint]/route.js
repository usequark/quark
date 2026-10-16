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
 *   visitor, not the Railway egress IP.
 * - 1 MB body cap + 5s upstream timeout bound abuse and slowloris cost.
 * - `Cache-Control: no-store` on every response; upstream `Set-Cookie` is
 *   stripped and never reaches the browser.
 * - Fail-open 202 on upstream 5xx/timeout so analytics never fails the
 *   product flow — and never retry-storms a struggling upstream.
 *
 * Deliberately NOT rate-limited by proxy.js: that limiter keys on `/api/*`
 * paths and analytics beacons must never 429. The body cap, content-type
 * gate, and timeout are the abuse bounds here.
 */

import { createLogger } from "@usequark/quark-core/core";
import { NextResponse } from "next/server";
import { getUmamiUpstreamBase } from "@/lib/analytics/umami-config.js";

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
		body = await request.arrayBuffer();
	} catch {
		return NextResponse.json(
			{ error: "Unreadable request body" },
			{ status: 400, headers: noStoreHeaders() },
		);
	}

	if (!body?.byteLength) {
		return NextResponse.json(
			{ error: "Empty body" },
			{ status: 400, headers: noStoreHeaders() },
		);
	}

	if (body.byteLength > MAX_BODY_BYTES) {
		return NextResponse.json(
			{ error: "Payload too large" },
			{ status: 413, headers: noStoreHeaders() },
		);
	}

	const upstreamBase = getUmamiUpstreamBase(process.env);
	if (!upstreamBase) {
		return NextResponse.json(
			{ ok: true, proxied: false },
			{ status: 202, headers: noStoreHeaders() },
		);
	}

	const incomingForwardedFor = request.headers.get("x-forwarded-for");
	const clientIp = resolveClientIp(request);
	const forwardedFor = incomingForwardedFor?.trim()
		? incomingForwardedFor
		: clientIp;

	const forwardHeaders = {
		"Content-Type": "application/json",
		"X-Forwarded-For": forwardedFor,
		"X-Real-IP": request.headers.get("x-real-ip")?.trim() || clientIp,
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
			body,
			headers: forwardHeaders,
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (error) {
		logger.warn("Umami ingest proxy upstream unreachable", {
			endpoint,
			message: error?.message ?? String(error),
		});
		return NextResponse.json(
			{ ok: true, proxied: false },
			{ status: 202, headers: noStoreHeaders() },
		);
	}

	if (upstreamResponse.status >= 500) {
		logger.warn("Umami ingest proxy upstream error", {
			endpoint,
			status: upstreamResponse.status,
		});
		return NextResponse.json(
			{ ok: true, proxied: false },
			{ status: 202, headers: noStoreHeaders() },
		);
	}

	let responseBody;
	try {
		responseBody = await upstreamResponse.arrayBuffer();
	} catch (error) {
		logger.warn("Umami ingest proxy upstream body unreadable", {
			endpoint,
			message: error?.message ?? String(error),
		});
		return NextResponse.json(
			{ ok: true, proxied: false },
			{ status: 202, headers: noStoreHeaders() },
		);
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
