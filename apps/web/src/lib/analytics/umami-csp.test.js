import assert from "node:assert/strict";
import test from "node:test";

import { buildContentSecurityPolicy } from "./umami-csp.js";

test("buildContentSecurityPolicy stays self-only for analytics in proxy mode", () => {
	const csp = buildContentSecurityPolicy({
		NODE_ENV: "production",
		NEXT_PUBLIC_UMAMI_URL: "https://stats.example.com/",
		NEXT_PUBLIC_UMAMI_WEBSITE_ID: "123e4567-e89b-12d3-a456-426614174000",
	});

	assert.match(csp, /script-src 'self' 'unsafe-inline'/);
	assert.match(csp, /connect-src 'self'/);
	assert.doesNotMatch(csp, /stats\.example\.com/);
	assert.doesNotMatch(csp, /unsafe-eval/);
	assert.doesNotMatch(csp, / ws:| wss:/);
});

test("buildContentSecurityPolicy keeps development-only directives in non-production", () => {
	const csp = buildContentSecurityPolicy({ NODE_ENV: "development" });

	assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
	assert.match(csp, /connect-src 'self' ws: wss:/);
	assert.doesNotMatch(csp, /stats\.example\.com/);
});
