import assert from "node:assert";
import { test } from "node:test";

// `auth.js` builds its provider list at import time, so the environment has to
// be in place before the import runs — a `beforeEach` would be too late, and the
// provider this suite is about only exists when both halves are configured.
process.env.GOOGLE_CLIENT_ID = "google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
process.env.NEXTAUTH_SECRET = "test-secret-that-is-at-least-32-characters";

const { getAuthOptions } = await import("./auth.js");
const { isEmailVerified } = await import("./email-verified.js");

/** A userinfo payload as Google sends it for a real account. */
const GOOGLE_PROFILE = {
	id: "google-sub-1",
	email: "alice@example.com",
	email_verified: "true",
	name: "Alice",
	picture: "https://example.com/a.png",
};

/**
 * The profile mapper configured on the Google provider.
 *
 * `GoogleProvider()` hands back its user-defined options nested under `options`,
 * and Auth.js hoists them onto the provider when it parses the list at runtime
 * — it destructures `options` off the factory output and merges it over the
 * defaults, which is how every documented `profile()` customization reaches the
 * callback handler. So `options.profile` is the mapper Auth.js will call.
 *
 * Asserting it is a function matters: a provider whose mapper was dropped would
 * otherwise fall back to Auth.js's default, which trusts `profile.email`
 * unconditionally, and the whole suite would pass against the vulnerable
 * configuration.
 */
function googleProfile() {
	const provider = getAuthOptions().providers.find((p) => p.id === "google");
	assert.ok(
		provider,
		"the Google provider should be registered when configured",
	);
	assert.strictEqual(
		typeof provider.options?.profile,
		"function",
		"the Google provider must map the profile it is handed",
	);
	return provider.options.profile;
}

/**
 * Whether the mapper lets a profile through.
 *
 * The refusal is thrown rather than returned, so "did it accept this" is a
 * question about the exception, not the return value.
 */
function mapperAccepts(profile) {
	// Resolved outside the try on purpose. The existence assertion in
	// `googleProfile()` has to be allowed to escape: swallowing it would make this
	// helper answer "refused" for a provider that has no mapper at all, and every
	// value in the table below would pass against the vulnerable default.
	const map = googleProfile();

	try {
		map(profile);
		return true;
	} catch {
		return false;
	}
}

test("the Google provider refuses a profile Google has not verified", () => {
	// The same gap as the mobile route, one layer up: the Prisma adapter creates
	// the user on first sight, so an unconfirmed address would reach the database
	// with the confirmation that is supposed to establish ownership of it skipped.
	assert.throws(
		() =>
			googleProfile()({
				...GOOGLE_PROFILE,
				email_verified: "false",
			}),
		/not verified/,
	);
});

test("the refusal names itself so an operator can tell it from a broken provider", () => {
	// Auth.js catches whatever the mapper throws and logs it as an
	// `OAuthProfileParseError` — the same bucket as a malformed provider response
	// or a user who cancelled. A bare TypeError in that log would be a puzzle; the
	// message is the only place the actual reason can be read.
	assert.throws(
		() => googleProfile()({ ...GOOGLE_PROFILE, email_verified: "false" }),
		(error) => {
			assert.strictEqual(error.name, "AppError");
			assert.strictEqual(error.code, "OAUTH_EMAIL_NOT_VERIFIED");
			return true;
		},
	);
});

test("the Google provider returns the profile when the address is verified", () => {
	// The happy path has to keep working exactly as before — same object, so the
	// adapter still gets the id, email, name and picture it expects.
	const profile = googleProfile()({ ...GOOGLE_PROFILE });

	assert.deepStrictEqual(profile, GOOGLE_PROFILE);
});

test("the Google provider accepts the boolean spelling of email_verified", () => {
	const profile = googleProfile()({
		...GOOGLE_PROFILE,
		email_verified: true,
	});

	assert.deepStrictEqual(profile, { ...GOOGLE_PROFILE, email_verified: true });
});

test("the Google provider treats anything short of an explicit confirmation as unverified", () => {
	// Only `true` in one of its two real spellings passes. A truthiness check
	// would accept the string "false" here and refuse every real sign-in.
	const unconfirmed = [
		undefined,
		null,
		"",
		"yes",
		"1",
		false,
		0,
		1,
		{},
		[],
		"truthy",
	];

	for (const email_verified of unconfirmed) {
		assert.strictEqual(
			mapperAccepts({ ...GOOGLE_PROFILE, email_verified }),
			false,
			`email_verified=${JSON.stringify(email_verified)} should be refused`,
		);
	}
});

test("the Google provider refuses a profile with no email_verified claim at all", () => {
	// Shaped as a distinct case because it is what a caller omitting the field
	// would produce, and "absent" must not read as a pass.
	const { email_verified: _omitted, ...withoutClaim } = GOOGLE_PROFILE;

	assert.throws(() => googleProfile()(withoutClaim), /not verified/);
});

test("the shared helper and the provider agree on what confirmed means", () => {
	// Both Google sign-in paths — this provider and the mobile route — decide on
	// the same rule. Two copies of it would be free to drift, and a drift would
	// read as "sign-in works on the web but not in the app".
	for (const email_verified of [
		"true",
		true,
		"false",
		false,
		undefined,
		"yes",
	]) {
		assert.strictEqual(
			isEmailVerified(email_verified),
			mapperAccepts({ ...GOOGLE_PROFILE, email_verified }),
			`the helper and the provider disagree about ${JSON.stringify(email_verified)}`,
		);
	}
});
