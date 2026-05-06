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

	await t.test("createAuthConfig throws when secret is missing", () => {
		const orig = process.env.NEXTAUTH_SECRET;
		delete process.env.NEXTAUTH_SECRET;
		try {
			assert.throws(
				() => createAuthConfig(),
				(err) => err instanceof Error && /NEXTAUTH_SECRET/.test(err.message),
			);
		} finally {
			if (orig !== undefined) process.env.NEXTAUTH_SECRET = orig;
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
