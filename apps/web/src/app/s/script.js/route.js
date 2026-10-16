/**
 * Umami First-Party Tracker Script
 *
 * GET /s/script.js → upstream Umami /script.js.
 *
 * Why a handler and not a `rewrites()` entry: a browser requesting a
 * same-origin script URL sends this app's cookies with it, and Next.js
 * external rewrites proxy incoming request headers unchanged — so a rewrite
 * would forward session cookies to the analytics host. (The previous
 * cross-origin `<script src>` never sent same-origin credentials.) This
 * handler forwards NO client headers at all: the upstream sees an anonymous
 * server-to-server fetch, and its `Set-Cookie` is stripped before the
 * response reaches the browser.
 *
 * Caching: the tracker is static and versioned by the upstream, so the
 * response is publicly cacheable (browser + CDN). The upstream fetch is
 * revalidated hourly so most script loads never touch the analytics host.
 */

import { createLogger } from "@usequark/quark-core/core";
import { NextResponse } from "next/server";
import { getUmamiUpstreamBase } from "@/lib/analytics/umami-config.js";

const logger = createLogger("umami-proxy");

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5000;
const SCRIPT_CACHE_CONTROL =
	"public, max-age=3600, stale-while-revalidate=86400";

function noStoreHeaders(extra = {}) {
	return { "Cache-Control": "no-store", ...extra };
}

function methodNotAllowed() {
	return NextResponse.json(
		{ error: "Method not allowed" },
		{ status: 405, headers: noStoreHeaders() },
	);
}

export async function GET() {
	const upstreamBase = getUmamiUpstreamBase(process.env);
	if (!upstreamBase) {
		return NextResponse.json(
			{ error: "Not found" },
			{ status: 404, headers: noStoreHeaders() },
		);
	}

	let upstreamResponse;
	try {
		// Deliberately no client headers: no Cookie, no Authorization, no
		// X-Forwarded-For. The tracker script is identical for every visitor.
		upstreamResponse = await fetch(`${upstreamBase}/script.js`, {
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			next: { revalidate: 3600 },
		});
	} catch (error) {
		logger.warn("Umami script proxy upstream unreachable", {
			message: error?.message ?? String(error),
		});
		return NextResponse.json(
			{ error: "Bad gateway" },
			{ status: 502, headers: noStoreHeaders() },
		);
	}

	if (!upstreamResponse.ok) {
		logger.warn("Umami script proxy upstream error", {
			status: upstreamResponse.status,
		});
		return NextResponse.json(
			{ error: "Bad gateway" },
			{ status: 502, headers: noStoreHeaders() },
		);
	}

	let body;
	try {
		body = await upstreamResponse.arrayBuffer();
	} catch (error) {
		logger.warn("Umami script proxy upstream body unreadable", {
			message: error?.message ?? String(error),
		});
		return NextResponse.json(
			{ error: "Bad gateway" },
			{ status: 502, headers: noStoreHeaders() },
		);
	}

	// Fresh headers: upstream Content-Type (or a JS default), public caching,
	// and never an upstream Set-Cookie.
	return new NextResponse(body, {
		status: 200,
		headers: {
			"Content-Type":
				upstreamResponse.headers.get("content-type") ??
				"application/javascript",
			"Cache-Control": SCRIPT_CACHE_CONTROL,
		},
	});
}

export function POST() {
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
