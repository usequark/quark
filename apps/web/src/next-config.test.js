import assert from "node:assert/strict";
import test from "node:test";

/**
 * `env.NEXTAUTH_URL` is inlined into the client bundle at build time.
 * When it resolved to `undefined`, next-auth/react fell back to its
 * hardcoded `http://localhost:3000/api/auth` regardless of PORT - so a dev
 * server on PORT=4000 (or a production origin from APP_URL) issued tokens
 * against a different origin than the page. These tests pin the fallback
 * chain: NEXTAUTH_URL > APP_URL > http://localhost:PORT.
 *
 * next.config.js reads env at module load, so each scenario needs its own
 * module instance (cache-busted via query string).
 */

function without(keys) {
	for (const key of keys) delete process.env[key];
}

test("NEXTAUTH_URL falls back to http://localhost:PORT", async () => {
	without(["NEXTAUTH_URL", "APP_URL"]);
	process.env.PORT = "4100";

	const mod = await import("../next.config.js?case=port-fallback");
	assert.equal(mod.default.env.NEXTAUTH_URL, "http://localhost:4100");
});

test("NEXTAUTH_URL defaults to port 3000 when PORT is unset", async () => {
	without(["NEXTAUTH_URL", "APP_URL", "PORT"]);

	const mod = await import("../next.config.js?case=default-port");
	assert.equal(mod.default.env.NEXTAUTH_URL, "http://localhost:3000");
});

test("APP_URL provides the NEXTAUTH_URL fallback before PORT", async () => {
	without(["NEXTAUTH_URL"]);
	process.env.APP_URL = "https://myapp.example.com";
	process.env.PORT = "4100";

	const mod = await import("../next.config.js?case=app-url");
	assert.equal(mod.default.env.NEXTAUTH_URL, "https://myapp.example.com");
});

test("explicit NEXTAUTH_URL wins", async () => {
	process.env.NEXTAUTH_URL = "https://auth.example.com";
	process.env.APP_URL = "https://myapp.example.com";

	const mod = await import("../next.config.js?case=explicit");
	assert.equal(mod.default.env.NEXTAUTH_URL, "https://auth.example.com");
});
