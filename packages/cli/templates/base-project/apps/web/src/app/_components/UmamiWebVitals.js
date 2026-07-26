"use client";

import { useEffect } from "react";
import { getUmamiUserRole } from "../../lib/analytics/umami.js";
import { getUmamiConfig } from "../../lib/analytics/umami-config.js";
import { observeWebVitals } from "../../lib/analytics/umami-web-vitals.js";

/**
 * Client component that mounts the anonymous Core Web Vitals observer.
 *
 * Must be rendered inside the root layout's `<body>` so that
 * `window` and `performance` APIs are available.
 *
 * Design:
 *  - Noop when Umami analytics is not configured or when
 *    the browser does not support PerformanceObserver.
 *  - Observes LCP, FID, CLS, INP, and TTFB and dispatches
 *    them as anonymous Umami custom events (event_type = 2).
 *  - Zero PII — only metric name, value, rating, and sanitised
 *    URL path are sent.
 *  - Cleans up all observers on unmount.
 */
export default function UmamiWebVitals() {
	useEffect(() => {
		const config = getUmamiConfig();
		if (!config.enabled) return;

		// Skip web vitals dispatch for admin users (identified by the
		// umami_user_role cookie set by the admin layout).
		const role = getUmamiUserRole();
		if (role === "admin" || role === "client_admin") return;

		const stopObserving = observeWebVitals();
		return () => {
			stopObserving();
		};
	}, []);

	return null;
}
