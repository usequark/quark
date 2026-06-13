import assert from "node:assert";
import { test } from "node:test";
import {
	createAuthConfig,
	getCurrentSession,
	getUserEmail,
	getUserId,
	isAuthenticated,
	requireAuth,
} from "../src/auth/index.js";

test("Auth Module", async (t) => {
	await t.test("createAuthConfig returns valid config", () => {
		const config = createAuthConfig({ secret: "test-secret" });
		assert(config.session);
		assert(config.session.strategy === "jwt");
		assert(config.session.maxAge === 30 * 24 * 60 * 60);
		assert.deepStrictEqual(config.providers, []);
	});

	await t.test("createAuthConfig falls back to AUTH_SECRET", () => {
		const nextAuthSecret = process.env.NEXTAUTH_SECRET;
		const authSecret = process.env.AUTH_SECRET;

		delete process.env.NEXTAUTH_SECRET;
		process.env.AUTH_SECRET = "test-secret";

		try {
			const config = createAuthConfig();
			assert.strictEqual(config.secret, "test-secret");
		} finally {
			if (nextAuthSecret !== undefined) {
				process.env.NEXTAUTH_SECRET = nextAuthSecret;
			} else {
				delete process.env.NEXTAUTH_SECRET;
			}

			if (authSecret !== undefined) {
				process.env.AUTH_SECRET = authSecret;
			} else {
				delete process.env.AUTH_SECRET;
			}
		}
	});

	await t.test("createAuthConfig throws when secret is missing", () => {
		const orig = process.env.NEXTAUTH_SECRET;
		const authOrig = process.env.AUTH_SECRET;
		delete process.env.NEXTAUTH_SECRET;
		delete process.env.AUTH_SECRET;
		try {
			assert.throws(
				() => createAuthConfig(),
				(err) =>
					err instanceof Error &&
					/NEXTAUTH_SECRET|AUTH_SECRET/.test(err.message),
			);
		} finally {
			if (orig !== undefined) process.env.NEXTAUTH_SECRET = orig;
			if (authOrig !== undefined) process.env.AUTH_SECRET = authOrig;
		}
	});

	await t.test("createAuthConfig with custom options", () => {
		const customProvider = { id: "custom" };
		const config = createAuthConfig({
			providers: [customProvider],
			secret: "test-secret",
		});

		assert.deepStrictEqual(config.providers, [customProvider]);
		assert(config.secret === "test-secret");
	});

	await t.test("createAuthConfig sets trustHost=true on Railway", () => {
		const key = "RAILWAY_SERVICE_ID";
		const orig = process.env[key];
		process.env[key] = "service-abc";
		try {
			const config = createAuthConfig({ secret: "test-secret" });
			assert.equal(config.trustHost, true);
		} finally {
			if (orig !== undefined) process.env[key] = orig;
			else delete process.env[key];
		}
	});

	await t.test(
		"createAuthConfig sets trustHost=true for non-localhost NEXTAUTH_URL",
		() => {
			const key = "NEXTAUTH_URL";
			const orig = process.env[key];
			process.env[key] = "https://myapp.com";
			try {
				const config = createAuthConfig({ secret: "test-secret" });
				assert.equal(config.trustHost, true);
			} finally {
				if (orig !== undefined) process.env[key] = orig;
				else delete process.env[key];
			}
		},
	);

	await t.test(
		"createAuthConfig sets trustHost=false for localhost NEXTAUTH_URL in production",
		() => {
			const urlKey = "NEXTAUTH_URL";
			const nodeEnvKey = "NODE_ENV";
			const origUrl = process.env[urlKey];
			const origNodeEnv = process.env[nodeEnvKey];
			process.env[urlKey] = "http://localhost:3000";
			process.env[nodeEnvKey] = "production";
			try {
				const config = createAuthConfig({ secret: "test-secret" });
				assert.equal(config.trustHost, false);
			} finally {
				if (origUrl !== undefined) process.env[urlKey] = origUrl;
				else delete process.env[urlKey];
				if (origNodeEnv !== undefined) process.env[nodeEnvKey] = origNodeEnv;
				else delete process.env[nodeEnvKey];
			}
		},
	);

	await t.test("createAuthConfig trusts user trustHost:true override", () => {
		const config = createAuthConfig({
			secret: "test-secret",
			trustHost: true,
		});
		assert.equal(config.trustHost, true);
	});

	await t.test("createAuthConfig trusts user trustHost:false override", () => {
		const key = "RAILWAY_SERVICE_ID";
		const orig = process.env[key];
		process.env[key] = "service-abc";
		try {
			const config = createAuthConfig({
				secret: "test-secret",
				trustHost: false,
			});
			assert.equal(config.trustHost, false);
		} finally {
			if (orig !== undefined) process.env[key] = orig;
			else delete process.env[key];
		}
	});

	await t.test("isAuthenticated returns true for valid session", () => {
		const session = {
			user: { email: "test@example.com", id: "123" },
		};
		assert(isAuthenticated(session));
	});

	await t.test("isAuthenticated returns false for invalid session", () => {
		assert(!isAuthenticated(null));
		assert(!isAuthenticated({ user: null }));
		assert(!isAuthenticated({ user: { email: null } }));
	});

	await t.test("getUserId extracts user ID", () => {
		const session = { user: { id: "user-123" } };
		assert(getUserId(session) === "user-123");
	});

	await t.test("getUserId returns null when missing", () => {
		assert(getUserId(null) === null);
		assert(getUserId({ user: null }) === null);
	});

	await t.test("getUserEmail extracts user email", () => {
		const session = { user: { email: "test@example.com" } };
		assert(getUserEmail(session) === "test@example.com");
	});

	await t.test("getUserEmail returns null when missing", () => {
		assert(getUserEmail(null) === null);
	});

	await t.test("requireAuth returns user ID for authenticated session", () => {
		const session = { user: { id: "user-123", email: "test@example.com" } };
		const userId = requireAuth(session);
		assert(userId === "user-123");
	});

	await t.test("requireAuth throws error for unauthenticated session", () => {
		assert.throws(
			() => requireAuth(null),
			(err) => err instanceof Error,
		);
	});

	await t.test(
		"getCurrentSession returns null when session lookup throws",
		async () => {
			const session = await getCurrentSession(async () => {
				throw new Error("session store unavailable");
			});

			assert.strictEqual(session, null);
		},
	);
});
