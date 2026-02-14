import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { getAllowedOrigins, getAppUrl, syncNextAuthUrl } from "./app-url.js";

describe("app-url", () => {
	/** Save original env so tests can restore it */
	const origEnv = {};
	const envKeys = [
		"APP_URL",
		"NEXTAUTH_URL",
		"WEB_PORT",
		"ALLOWED_ORIGINS",
		"NODE_ENV",
	];

	before(() => {
		for (const k of envKeys) origEnv[k] = process.env[k];
	});

	after(() => {
		for (const k of envKeys) {
			if (origEnv[k] === undefined) delete process.env[k];
			else process.env[k] = origEnv[k];
		}
	});

	function clearEnvKeys() {
		for (const k of envKeys) delete process.env[k];
	}

	// --- getAppUrl ---

	describe("getAppUrl", () => {
		it("returns APP_URL when set", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			assert.equal(getAppUrl(), "https://myapp.com");
		});

		it("strips trailing slash", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com/";
			assert.equal(getAppUrl(), "https://myapp.com");
		});

		it("falls back to NEXTAUTH_URL", () => {
			clearEnvKeys();
			process.env.NEXTAUTH_URL = "https://legacy.com";
			assert.equal(getAppUrl(), "https://legacy.com");
		});

		it("prefers APP_URL over NEXTAUTH_URL", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://primary.com";
			process.env.NEXTAUTH_URL = "https://legacy.com";
			assert.equal(getAppUrl(), "https://primary.com");
		});

		it("falls back to localhost with WEB_PORT", () => {
			clearEnvKeys();
			process.env.WEB_PORT = "4000";
			assert.equal(getAppUrl(), "http://localhost:4000");
		});

		it("defaults to http://localhost:3000", () => {
			clearEnvKeys();
			assert.equal(getAppUrl(), "http://localhost:3000");
		});
	});

	// --- getAllowedOrigins ---

	describe("getAllowedOrigins", () => {
		it("always includes the canonical APP_URL", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NODE_ENV = "production";
			const origins = getAllowedOrigins();
			assert.ok(origins.includes("https://myapp.com"));
		});

		it("adds ALLOWED_ORIGINS extras", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NODE_ENV = "production";
			process.env.ALLOWED_ORIGINS =
				"https://admin.myapp.com,https://cdn.myapp.com";
			const origins = getAllowedOrigins();
			assert.ok(origins.includes("https://myapp.com"));
			assert.ok(origins.includes("https://admin.myapp.com"));
			assert.ok(origins.includes("https://cdn.myapp.com"));
		});

		it("de-duplicates origins", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NODE_ENV = "production";
			process.env.ALLOWED_ORIGINS = "https://myapp.com,https://extra.com";
			const origins = getAllowedOrigins();
			const count = origins.filter((o) => o === "https://myapp.com").length;
			assert.equal(count, 1);
		});

		it("adds localhost origins in development", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			// NODE_ENV not set → not production → dev mode
			const origins = getAllowedOrigins();
			assert.ok(origins.includes("http://localhost:3000"));
			assert.ok(origins.includes("http://localhost:3001"));
		});

		it("does NOT add localhost in production", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NODE_ENV = "production";
			const origins = getAllowedOrigins();
			assert.ok(!origins.includes("http://localhost:3000"));
			assert.ok(!origins.includes("http://localhost:3001"));
		});
	});

	// --- syncNextAuthUrl ---

	describe("syncNextAuthUrl", () => {
		it("sets NEXTAUTH_URL from APP_URL when not set", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			syncNextAuthUrl();
			assert.equal(process.env.NEXTAUTH_URL, "https://myapp.com");
		});

		it("does not override existing NEXTAUTH_URL", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NEXTAUTH_URL = "https://custom.com";
			syncNextAuthUrl();
			assert.equal(process.env.NEXTAUTH_URL, "https://custom.com");
		});
	});
});
