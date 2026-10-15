import assert from "node:assert";
import { beforeEach, mock, test } from "node:test";
import { hashPassword } from "@usequark/quark-core/auth";
import { AppError } from "@usequark/quark-core/errors";

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// `auth.js` reaches the database only through `@usequark/quark-db`'s `user`
// queries, so that is the seam. Everything else (Auth.js wiring, provider
// config) is real — the point of these tests is the `jwt` callback's
// revocation contract, which lives in `auth.js` itself.

let findByIdImpl = async () => null;
let findByEmailImpl = async () => null;

/**
 * Result of `isEmailVerificationRequired()`.
 *
 * Set from env through `loadConfig()`, which validates the whole environment on
 * its first call — something a unit test does not provide. Defaulted to the
 * value the scaffold ships, so the suite runs against the shipped
 * configuration; only the opt-out test flips it.
 */
let emailVerificationRequired = true;

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

mock.module("./auth-email-verification.js", {
	namedExports: {
		isEmailVerificationRequired: () => emailVerificationRequired,
	},
});

const { getAuthOptions } = await import("./auth.js");

/**
 * The credentials provider's `authorize`.
 *
 * Read from `options`, not the provider object: `Credentials()` hands back its
 * own `authorize: () => null` as the default and nests the config — including
 * the `authorize` the app actually wrote — under `options`. Auth.js merges the
 * two in `parseProviders` (`merge(defaults, userOptions)`), so `options` wins at
 * runtime. Asserting on the merged value's source is the same reasoning the
 * Google profile suite uses for `options.profile`: a test that called the
 * factory default would exercise `() => null` and pass against a provider with
 * no real authorize at all.
 */
function authorize() {
	const provider = getAuthOptions().providers.find(
		(p) => p.id === "credentials",
	);
	assert.ok(provider, "the scaffold must ship a credentials provider");
	assert.equal(
		typeof provider.options?.authorize,
		"function",
		"the credentials provider must carry the authorize() the app defines",
	);
	return provider.options.authorize;
}

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
	emailVerificationRequired = true;
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

// ── Credentials: email verification ──────────────────────────────────────────
//
// OAuth takes its verdict from the provider's `email_verified` claim;
// credentials has no provider, so the verdict is `User.emailVerified`, which
// only `/api/auth/verify-email` ever sets. One flag governs both, and it
// defaults to on.

const CREDENTIALS = {
	email: "user@example.com",
	password: "correct horse battery staple",
};

/** Real bcrypt hash, so `verifyPassword` is the production code path. */
const PASSWORD_HASH = await hashPassword(CREDENTIALS.password);

/** The row the credentials lookup finds, verified unless overridden. */
function credentialsRow(overrides = {}) {
	return {
		id: "user-1",
		email: CREDENTIALS.email,
		name: "User",
		image: null,
		role: "editor",
		password: PASSWORD_HASH,
		emailVerified: new Date("2026-01-01T00:00:00Z"),
		...overrides,
	};
}

test("credentials sign-in refuses an unverified address", async () => {
	// Refused by throwing, not by returning null. The `catch` around the lookup
	// converts unexpected errors into `null`, which Auth.js reports as "Invalid
	// credentials" — a reason that tells an operator nothing. A rejection here is
	// therefore the assertion: a `resolve(null)` means the refusal was swallowed.
	findByEmailImpl = async () => credentialsRow({ emailVerified: null });

	await assert.rejects(
		authorize()({ ...CREDENTIALS }),
		(error) => {
			assert.ok(error instanceof AppError, "expected an AppError");
			assert.equal(error.code, "OAUTH_EMAIL_NOT_VERIFIED");
			assert.equal(error.statusCode, 401);
			return true;
		},
		"an unverified address must be refused with the OAuth error",
	);
});

test("a null and an unset emailVerified both read as unverified", async () => {
	// `emailVerified` is a nullable column with no default: a row created by an
	// older signup, by the seed, or by any path that never sent the link has
	// neither value. Both must refuse, or "unset" becomes the loophole.
	for (const emailVerified of [null, undefined]) {
		findByEmailImpl = async () => credentialsRow({ emailVerified });

		await assert.rejects(
			authorize()({ ...CREDENTIALS }),
			(error) => error?.code === "OAUTH_EMAIL_NOT_VERIFIED",
			`emailVerified=${JSON.stringify(emailVerified)} must be refused`,
		);
	}
});

test("credentials sign-in works when the address is verified", async () => {
	// The refusal must not be a blanket sign-in outage. A row that has been
	// through the verification flow still signs in, and still returns the same
	// identity shape Auth.js stamps onto the token.
	findByEmailImpl = async () => credentialsRow();

	const result = await authorize()({ ...CREDENTIALS });

	assert.deepEqual(result, {
		id: "user-1",
		email: CREDENTIALS.email,
		name: "User",
		image: null,
		role: "editor",
	});
});

test("REQUIRE_EMAIL_VERIFICATION=false restores the pre-gate sign-in", async () => {
	// The opt-out has to reach this path as well as the OAuth ones, or turning it
	// off would leave credentials locked while OAuth opened — the split the
	// single flag exists to prevent.
	emailVerificationRequired = false;
	findByEmailImpl = async () => credentialsRow({ emailVerified: null });

	const result = await authorize()({ ...CREDENTIALS });

	assert.ok(
		result,
		"an unverified address must sign in once enforcement is off",
	);
	assert.equal(result.id, "user-1");
});

test("a wrong password is a plain refusal, not a verification error", async () => {
	// Password before verification, deliberately. The other order would answer
	// "does this address exist, and has it been confirmed" for anyone who can
	// submit a name — an enumeration oracle handed over by the error code.
	findByEmailImpl = async () => credentialsRow({ emailVerified: null });

	const result = await authorize()({
		email: CREDENTIALS.email,
		password: "not the password",
	});

	assert.equal(result, null);
});
