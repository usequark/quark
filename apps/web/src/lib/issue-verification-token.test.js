import assert from "node:assert";
import { afterEach, beforeEach, mock, test } from "node:test";

// ── Mocks ────────────────────────────────────────────────────────────────────

const auth = await import("@usequark/quark-core/auth");

// `generateToken` is stubbed so the returned raw value is predictable;
// `hashToken` stays real so "stores the digest" is asserted against the true
// digest rather than a value the mock happens to agree with.
mock.module("@usequark/quark-core/auth", {
	namedExports: {
		...auth,
		generateToken: () => "raw-token-value",
	},
});

const db = await import("@usequark/quark-db");

let createCalls;
let deletionCalls;

mock.module("@usequark/quark-db", {
	namedExports: {
		...db,
		verificationToken: {
			create: async (data) => {
				createCalls.push(data);
				return { ...data };
			},
			deleteByIdentifier: async (identifier) => {
				deletionCalls.push(identifier);
			},
		},
	},
});

const { issueVerificationToken, RESET_TOKEN_TTL_MS, VERIFY_TOKEN_TTL_MS } =
	await import("./issue-verification-token.js");

beforeEach(() => {
	createCalls = [];
	deletionCalls = [];
});

afterEach(() => {
	mock.restoreAll();
});

const IDENTIFIER = "user@example.com";

test("deletes any outstanding token before issuing a replacement", async () => {
	await issueVerificationToken(IDENTIFIER, RESET_TOKEN_TTL_MS);

	// One live link per address: an old email must stop working the moment a
	// new one is requested, not silently share the mailbox with the new link.
	assert.deepStrictEqual(deletionCalls, [IDENTIFIER]);
	assert.strictEqual(createCalls.length, 1);
});

test("returns the raw token for the emailed link", async () => {
	const raw = await issueVerificationToken(IDENTIFIER, VERIFY_TOKEN_TTL_MS);

	assert.strictEqual(raw, "raw-token-value");
});

test("stores only the SHA-256 digest, never the raw token", async () => {
	await issueVerificationToken(IDENTIFIER, VERIFY_TOKEN_TTL_MS);

	// A leaked row must not be redeemable. The raw value belongs only in the
	// emailed link; lookup hashes what the link carries, so digest and presented
	// value meet in the query.
	assert.strictEqual(createCalls[0].identifier, IDENTIFIER);
	assert.strictEqual(createCalls[0].token, auth.hashToken("raw-token-value"));
	assert.notStrictEqual(createCalls[0].token, "raw-token-value");
});

test("creates the row with an expiry honoring the requested TTL", async () => {
	const before = Date.now();
	await issueVerificationToken(IDENTIFIER, VERIFY_TOKEN_TTL_MS);
	const after = Date.now();

	// The expiry is computed as `now + TTL` at some instant inside
	// [before, after]. Bounding it by `before + TTL` alone assumes the call
	// completed in the same millisecond it started: one tick later the expiry
	// is `before + TTL + 1` and the assertion fails on a slower machine. The
	// window keeps it true regardless of scheduling.
	const expires = createCalls[0].expires.getTime();
	assert.ok(
		expires >= before + VERIFY_TOKEN_TTL_MS,
		"expiry is at least the TTL ahead",
	);
	assert.ok(
		expires <= after + VERIFY_TOKEN_TTL_MS,
		"expiry is no more than the TTL ahead",
	);
});

test("reset and verify links carry their distinct lifetimes", async () => {
	const resetBefore = Date.now();
	await issueVerificationToken(IDENTIFIER, RESET_TOKEN_TTL_MS);
	const resetAfter = Date.now();
	const resetExpires = createCalls[0].expires.getTime();

	const verifyBefore = Date.now();
	await issueVerificationToken(IDENTIFIER, VERIFY_TOKEN_TTL_MS);
	const verifyAfter = Date.now();
	const verifyExpires = createCalls[1].expires.getTime();

	// An address is confirmed on the user's own schedule (24h); a reset is
	// acted on in the hour it arrives (1h). The emailed templates quote the
	// same windows, so the two TTLs must differ or one of the emails is lying.
	// Each expiry is bounded by the window its call ran in — a single sample of
	// `now` on the low end cannot serve as the upper bound, because it is only
	// exact when the call lands in that same millisecond.
	assert.strictEqual(RESET_TOKEN_TTL_MS, 60 * 60 * 1000);
	assert.strictEqual(VERIFY_TOKEN_TTL_MS, 24 * 60 * 60 * 1000);
	assert.notStrictEqual(RESET_TOKEN_TTL_MS, VERIFY_TOKEN_TTL_MS);
	assert.ok(
		resetExpires >= resetBefore + RESET_TOKEN_TTL_MS &&
			resetExpires <= resetAfter + RESET_TOKEN_TTL_MS,
		"reset expiry is one hour after issuance",
	);
	assert.ok(
		verifyExpires >= verifyBefore + VERIFY_TOKEN_TTL_MS &&
			verifyExpires <= verifyAfter + VERIFY_TOKEN_TTL_MS,
		"verify expiry is 24 hours after issuance",
	);
});
