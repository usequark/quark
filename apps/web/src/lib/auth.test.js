import assert from "node:assert";
import { beforeEach, mock, test } from "node:test";

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// `auth.js` reaches the database only through `@usequark/quark-db`'s `user`
// queries, so that is the seam. Everything else (Auth.js wiring, provider
// config) is real — the point of these tests is the `jwt` callback's
// revocation contract, which lives in `auth.js` itself.

let findByIdImpl = async () => null;
let findByEmailImpl = async () => null;

mock.module("@usequark/quark-db", {
	namedExports: {
		Prisma: {
			PrismaClientInitializationError: class extends Error {},
			PrismaClientKnownRequestError: class extends Error {},
		},
		prisma: {},
		user: {
			findById: (...args) => findByIdImpl(...args),
			findByEmail: (...args) => findByEmailImpl(...args),
		},
	},
});

const { getAuthOptions } = await import("./auth.js");

/** The `jwt` callback under test. */
function jwtCallback() {
	return getAuthOptions().callbacks.jwt;
}

const SIGN_IN_USER = {
	id: "user-1",
	email: "user@example.com",
	name: "User",
	image: null,
	role: "editor",
};

beforeEach(() => {
	process.env.NEXTAUTH_SECRET = "test-secret";
	findByIdImpl = async () => null;
	findByEmailImpl = async () => null;
});

test("sign-in stamps the identity onto the token without a database round trip", async () => {
	let lookups = 0;
	findByIdImpl = async () => {
		lookups += 1;
		return null;
	};

	const result = await jwtCallback()({
		token: { sub: "user-1" },
		user: SIGN_IN_USER,
	});

	assert.equal(result.id, "user-1");
	assert.equal(result.email, "user@example.com");
	assert.equal(result.role, "editor");
	assert.equal(lookups, 0, "sign-in must not pay for the revocation check");
});

test("every subsequent request refreshes the role from the database", async () => {
	findByIdImpl = async (id) => {
		assert.equal(id, "user-1");
		return { ...SIGN_IN_USER, role: "admin" };
	};

	const result = await jwtCallback()({
		token: { id: "user-1", role: "viewer" },
		user: undefined,
	});

	assert.equal(
		result.role,
		"admin",
		"a demotion/promotion takes effect immediately",
	);
	assert.equal(result.email, "user@example.com");
});

test("a deleted user's token is rejected", async () => {
	findByIdImpl = async () => null;

	const result = await jwtCallback()({
		token: { id: "user-gone", role: "admin" },
		user: undefined,
	});

	assert.equal(
		result,
		null,
		"Auth.js clears the cookie when jwt() returns null",
	);
});

test("tokens issued before a password change are rejected", async () => {
	const passwordChangedAt = new Date("2026-10-11T12:00:00Z");
	findByIdImpl = async () => ({ ...SIGN_IN_USER, passwordChangedAt });

	const result = await jwtCallback()({
		// iat is seconds; one hour before the change.
		token: {
			id: "user-1",
			role: "editor",
			iat: Math.floor(passwordChangedAt.getTime() / 1000) - 3600,
		},
		user: undefined,
	});

	assert.equal(
		result,
		null,
		"a session born under the old password dies with it",
	);
});

test("tokens issued after a password change survive", async () => {
	const passwordChangedAt = new Date("2026-10-11T12:00:00Z");
	findByIdImpl = async () => ({ ...SIGN_IN_USER, passwordChangedAt });

	const result = await jwtCallback()({
		token: {
			id: "user-1",
			role: "editor",
			iat: Math.floor(passwordChangedAt.getTime() / 1000) + 60,
		},
		user: undefined,
	});

	assert.notEqual(result, null);
	assert.equal(result.id, "user-1");
});

test("a token without a user id is rejected without a lookup", async () => {
	let lookups = 0;
	findByIdImpl = async () => {
		lookups += 1;
		return SIGN_IN_USER;
	};

	const result = await jwtCallback()({
		token: { sub: "something-without-id" },
		user: undefined,
	});

	assert.equal(result, null);
	assert.equal(lookups, 0);
});

test("a database error fails closed", async () => {
	findByIdImpl = async () => {
		throw new Error("connection refused");
	};

	const result = await jwtCallback()({
		token: { id: "user-1", role: "admin" },
		user: undefined,
	});

	assert.equal(
		result,
		null,
		"an unreachable database must not admit an unverified cookie",
	);
});

test("the session strategy stays jwt (credentials constraint) with a 30-day maxAge", () => {
	const { session } = getAuthOptions();

	assert.equal(session.strategy, "jwt");
	assert.equal(session.maxAge, 30 * 24 * 60 * 60);
});

test("the default session callback maps id and role from the token", async () => {
	const session = await getAuthOptions().callbacks.session({
		session: { user: { name: "User", email: "user@example.com" }, expires: "" },
		token: { id: "user-1", role: "editor" },
	});

	assert.equal(session.user.id, "user-1");
	assert.equal(session.user.role, "editor");
});
