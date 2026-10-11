import assert from "node:assert";
import { afterEach, beforeEach, mock, test } from "node:test";
import { pathToFileURL } from "node:url";

// ── Mocks ────────────────────────────────────────────────────────────────────

mock.module("@usequark/quark-config", {
	namedExports: {
		getAppUrl: () => "https://app.test",
	},
});

const issueUrl = pathToFileURL(
	new URL("./issue-verification-token.js", import.meta.url).pathname,
).href;

// The real module is spread so `RESET_TOKEN_TTL_MS` stays the genuine export:
// the point of the test is that this helper requests the *reset* TTL, and a
// duplicated literal would let the two helpers silently swap constants.
const issueMod = await import("./issue-verification-token.js");

/** Every (identifier, ttlMs) handed to `issueVerificationToken`. */
let issueCalls;

mock.module(issueUrl, {
	namedExports: {
		...issueMod,
		issueVerificationToken: async (identifier, ttlMs) => {
			issueCalls.push({ identifier, ttlMs });
			return "raw-token-value";
		},
	},
});

const enqueueUrl = pathToFileURL(
	new URL("./enqueue-reset-password-email.js", import.meta.url).pathname,
).href;

/** Every (userId, resetUrl) handed to `enqueueResetPasswordEmail`. */
let enqueueCalls;

mock.module(enqueueUrl, {
	namedExports: {
		enqueueResetPasswordEmail: async (userId, resetUrl) => {
			enqueueCalls.push({ userId, resetUrl });
		},
	},
});

const { sendResetPasswordEmail } = await import(
	"./send-reset-password-email.js"
);

beforeEach(() => {
	issueCalls = [];
	enqueueCalls = [];
});

afterEach(() => {
	mock.restoreAll();
});

const ACCOUNT = { id: "user-1", email: "user@example.com" };

test("issues a 1h reset token for the account's address", async () => {
	await sendResetPasswordEmail(ACCOUNT);

	assert.deepStrictEqual(issueCalls, [
		{ identifier: "user@example.com", ttlMs: 60 * 60 * 1000 },
	]);
});

test("enqueues the email carrying the single-use link", async () => {
	await sendResetPasswordEmail(ACCOUNT);

	// The worker resolves the address from the id, so the mail cannot be
	// diverted to an attacker-chosen mailbox by the caller.
	assert.deepStrictEqual(enqueueCalls, [
		{
			userId: "user-1",
			resetUrl: "https://app.test/auth/reset-password?token=raw-token-value",
		},
	]);
});
