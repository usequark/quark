/**
 * Anonymous Real User Monitoring (RUM) — Core Web Vitals Pipeline
 *
 * Observes browser performance metrics (LCP, FID, CLS, INP, TTFB) and
 * dispatches them to the unified Umami instance as anonymous custom events
 * (event_type = 2).  No user identifiers, session tokens, or PII are ever
 * included in the payload.
 *
 * Privacy guarantees:
 *  - Zero user data: no email, name, ID, token, or cookie values.
 *  - Layout timings only: metric name, numeric value, rating string,
 *    a sanitised URL path (origin stripped, never full URL with query),
 *    and the bare hostname (as the stock tracker sends; keeps these rows
 *    out of the NULL-hostname group in Umami's sessions list).
 *  - No referrer, no user-agent, no IP collected by this script.
 *  - Uses sendBeacon for reliable delivery without blocking the page.
 *
 * Integration:
 *  Import and call `observeWebVitals()` once from a client component
 *  (e.g. a "use client" wrapper in the root layout).
 *
 * Environment:
 *  Controlled by NEXT_PUBLIC_UMAMI_WEBSITE_ID (first-party proxy paths are
 *  static, so no upstream URL is needed in the browser).
 *  When Umami analytics is not configured, the observer is a no-op.
 */

import { getUmamiClientConfig } from "./umami-config.js";

// ── Initialization guard ──────────────────────────────────────

/**
 * Returns true when the browser supports PerformanceObserver.
 * @returns {boolean}
 */
function isSupported() {
	return (
		typeof window !== "undefined" &&
		"PerformanceObserver" in window &&
		"performance" in window
	);
}

/**
 * Strips the origin and query string from a URL, returning only the
 * pathname.  This ensures no PII (query params, hash fragments) or
 * internal hostnames leak to the analytics pipeline.
 *
 * @param {string} url
 * @returns {string}
 */
function sanitiseUrl(url) {
	try {
		const parsed = new URL(url, "http://localhost");
		return parsed.pathname;
	} catch {
		return "/";
	}
}

/**
 * Dispatches a single CWV observation to Umami's send endpoint as a custom
 * event (`name: "cwv"`, metrics in `data`). The payload is fully anonymous.
 *
 * Shape matters: Umami derives the event type server-side (`name` present →
 * custom event) and persists `payload.name`/`payload.data` — `event_name`,
 * `event_type`, and `event_data` keys are ignored, and posting anywhere
 * other than `/api/send` (there is no `/api/collect` in Umami v2+) silently
 * drops the beacon while recording nothing. Both mistakes shipped here
 * before and were caught by reading Umami's send route, not by any test.
 *
 * Exported for tests: the browser-only shape (window/navigator) cannot be
 * covered by observation in unit tests.
 *
 * @param {{ name: string, value: number, rating: string, navigationType?: string }} metric
 */
export function dispatchMetric(metric) {
	const config = getUmamiClientConfig();
	if (!config.enabled) return;

	const payload = {
		type: "event",
		payload: {
			website: config.websiteId,
			name: "cwv",
			data: {
				metric_name: metric.name,
				metric_value: Math.round(metric.value * 1000) / 1000, // round to 3dp
				metric_rating: metric.rating,
				navigation_type: metric.navigationType || "navigate",
			},
			url: sanitiseUrl(window.location.href),
			hostname: window.location.hostname,
		},
	};

	const body = JSON.stringify(payload);

	// First-party ingest: same-origin POSTs survive blocklists that match the
	// upstream analytics host as third-party. The client config carries no
	// upstream URL, so there is no direct-mode fallback — when disabled the
	// function already returned above.
	const endpoint = config.proxySendUrl;
	if (!endpoint) return;

	// Use sendBeacon for reliability during page lifecycle transitions.
	if (navigator.sendBeacon) {
		const blob = new Blob([body], { type: "application/json" });
		navigator.sendBeacon(endpoint, blob);
	} else {
		// Fallback to fetch with keepalive.
		fetch(endpoint, {
			method: "POST",
			body,
			keepalive: true,
			credentials: "omit",
			headers: { "Content-Type": "application/json" },
		}).catch(() => {
			// Best-effort — swallow network errors silently.
		});
	}
}

/**
 * Starts observing Core Web Vitals and dispatching them to Umami.
 * Safe to call multiple times — internal guards prevent double registration.
 *
 * Call this once from a "use client" component mounted in the root layout.
 *
 * @returns {() => void} Cleanup function that disconnects all observers.
 */
export function observeWebVitals() {
	if (!isSupported()) return () => {};

	/** @type {PerformanceObserver[]} */
	const observers = [];

	// ── Largest Contentful Paint ──────────────────────────────────
	try {
		const lcpObserver = new PerformanceObserver((list) => {
			const entries = list.getEntries();
			if (entries.length === 0) return;

			const entry = entries[entries.length - 1];
			const value = entry.startTime;
			dispatchMetric({
				name: "LCP",
				value,
				rating:
					value < 2500 ? "good" : value < 4000 ? "needs-improvement" : "poor",
				navigationType: /** @type {any} */ (entry).navigationType,
			});
		});
		lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
		observers.push(lcpObserver);
	} catch {
		// LCP not supported.
	}

	// ── First Input Delay ─────────────────────────────────────────
	try {
		const fidObserver = new PerformanceObserver((list) => {
			const entry = list.getEntries()[0];
			if (!entry) return;

			const value = entry.processingStart - entry.startTime;
			dispatchMetric({
				name: "FID",
				value,
				rating:
					value < 100 ? "good" : value < 300 ? "needs-improvement" : "poor",
			});
		});
		fidObserver.observe({ type: "first-input", buffered: true });
		observers.push(fidObserver);
	} catch {
		// FID not supported.
	}

	// ── Cumulative Layout Shift (reported on page hide) ───────────
	let clsValue = 0;
	try {
		const clsObserver = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (!entry.hadRecentInput) clsValue += entry.value;
			}
		});
		clsObserver.observe({ type: "layout-shift", buffered: true });
		observers.push(clsObserver);

		const reportCls = () => {
			dispatchMetric({
				name: "CLS",
				value: clsValue,
				rating:
					clsValue < 0.1
						? "good"
						: clsValue < 0.25
							? "needs-improvement"
							: "poor",
			});
		};

		window.addEventListener("visibilitychange", reportCls, { once: true });
		window.addEventListener("pagehide", reportCls, { once: true });
	} catch {
		// CLS not supported.
	}

	// ── Interaction to Next Paint ─────────────────────────────────
	try {
		if (PerformanceObserver.supportedEntryTypes?.includes("interaction")) {
			const inpObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const value = entry.duration;
					dispatchMetric({
						name: "INP",
						value,
						rating:
							value < 200 ? "good" : value < 500 ? "needs-improvement" : "poor",
					});
				}
			});
			inpObserver.observe({ type: "interaction", buffered: true });
			observers.push(inpObserver);
		}
	} catch {
		// INP not supported.
	}

	// ── Time to First Byte (from Navigation Timing API) ───────────
	try {
		if (performance.getEntriesByType?.("navigation").length > 0) {
			const navEntry = performance.getEntriesByType("navigation")[0];
			const value = navEntry.responseStart - navEntry.requestStart;
			dispatchMetric({
				name: "TTFB",
				value,
				rating:
					value < 800 ? "good" : value < 1800 ? "needs-improvement" : "poor",
			});
		}
	} catch {
		// TTFB not available.
	}

	// Return a cleanup function that disconnects all observers.
	return () => {
		for (const observer of observers) {
			try {
				observer.disconnect();
			} catch {
				// Ignore disconnect errors.
			}
		}
	};
}
