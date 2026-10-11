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

	const expires = createCalls[0].expires.getTime();
	assert.ok(expires >= before, "expiry is in the future");
	assert.ok(expires <= before + VERIFY_TOKEN_TTL_MS, "expiry honors the TTL");
});

test("reset and verify links carry their distinct lifetimes", async () => {
	const resetBefore = Date.now();
	await issueVerificationToken(IDENTIFIER, RESET_TOKEN_TTL_MS);
	const resetExpires = createCalls[0].expires.getTime();

	const verifyBefore = Date.now();
	await issueVerificationToken(IDENTIFIER, VERIFY_TOKEN_TTL_MS);
	const verifyExpires = createCalls[1].expires.getTime();

	// An address is confirmed on the user's own schedule (24h); a reset is
	// acted on in the hour it arrives (1h). The emailed templates quote the
	// same windows, so the TTLs are asserted distinct and each expiry is
	// checked against its own window — strict inequality between two expiries
	// computed within the same millisecond is not something to depend on.
	assert.strictEqual(RESET_TOKEN_TTL_MS, 60 * 60 * 1000);
	assert.strictEqual(VERIFY_TOKEN_TTL_MS, 24 * 60 * 60 * 1000);
	assert.ok(
		resetExpires >= resetBefore &&
			resetExpires <= resetBefore + RESET_TOKEN_TTL_MS,
		"reset expiry honors the 1h TTL",
	);
	assert.ok(
		verifyExpires >= verifyBefore &&
			verifyExpires <= verifyBefore + VERIFY_TOKEN_TTL_MS,
		"verify expiry honors the 24h TTL",
	);
});
