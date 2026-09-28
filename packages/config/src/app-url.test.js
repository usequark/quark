import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { getAllowedOrigins, getAppUrl, syncNextAuthUrl } from "./app-url.js";

describe("app-url", () => {
	/** Save original env so tests can restore it */
	const origEnv = {};
	const envKeys = [
		"APP_URL",
		"NEXTAUTH_URL",
		"PORT",
		"ALLOWED_ORIGINS",
		"NODE_ENV",
		"NEXT_DEV_ALLOWED_ORIGINS",
		"ALLOWED_DEV_ORIGINS",
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

		it("falls back to localhost with PORT", () => {
			clearEnvKeys();
			process.env.PORT = "4000";
			assert.equal(getAppUrl(), "http://localhost:4000");
		});

		it("defaults to http://localhost:3000", () => {
			clearEnvKeys();
			assert.equal(getAppUrl(), "http://localhost:3000");
		});

		it("ignores invalid PORT values in the localhost fallback", () => {
			clearEnvKeys();
			process.env.PORT = "abc";
			assert.equal(getAppUrl(), "http://localhost:3000");
		});

		it("throws a clear error for APP_URL without a scheme", () => {
			clearEnvKeys();
			process.env.APP_URL = "example.com";
			assert.throws(
				() => getAppUrl(),
				/APP_URL must be an absolute http\(s\) URL/,
			);
		});

		it("throws a clear error for NEXTAUTH_URL without a scheme", () => {
			clearEnvKeys();
			process.env.NEXTAUTH_URL = "example.com";
			assert.throws(
				() => getAppUrl(),
				/NEXTAUTH_URL must be an absolute http\(s\) URL/,
			);
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

		it("derives dev origins from process.env.PORT, not the config default", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.PORT = "4000";
			const origins = getAllowedOrigins();
			assert.ok(origins.includes("http://localhost:4000"));
			assert.ok(origins.includes("http://localhost:4001"));
			// Regression: string concatenation turned PORT=3000 into :30001
			assert.ok(!origins.some((o) => o.includes(":30001")));
			assert.ok(!origins.includes("http://localhost:3000"));
		});

		it("adds 127.0.0.1 loopback origins in development", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.PORT = "4000";
			const origins = getAllowedOrigins();
			assert.ok(origins.includes("http://127.0.0.1:4000"));
			assert.ok(origins.includes("http://127.0.0.1:4001"));
		});

		it("does NOT add 127.0.0.1 in production", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NODE_ENV = "production";
			process.env.PORT = "4000";
			const origins = getAllowedOrigins();
			assert.ok(!origins.some((o) => o.includes("127.0.0.1")));
			assert.ok(!origins.some((o) => o.includes("localhost")));
		});

		it("includes NEXT_DEV_ALLOWED_ORIGINS host extras in development", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NEXT_DEV_ALLOWED_ORIGINS =
				"192.168.1.50,http://my-laptop.local";
			const origins = getAllowedOrigins();
			assert.ok(origins.includes("http://192.168.1.50"));
			assert.ok(origins.includes("http://my-laptop.local"));
		});

		it("includes ALLOWED_DEV_ORIGINS host extras in development", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.ALLOWED_DEV_ORIGINS = "tunnel.example.com";
			const origins = getAllowedOrigins();
			assert.ok(origins.includes("http://tunnel.example.com"));
		});

		it("does NOT include dev host extras in production", () => {
			clearEnvKeys();
			process.env.APP_URL = "https://myapp.com";
			process.env.NODE_ENV = "production";
			process.env.NEXT_DEV_ALLOWED_ORIGINS = "192.168.1.50";
			const origins = getAllowedOrigins();
			assert.ok(!origins.includes("http://192.168.1.50"));
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
