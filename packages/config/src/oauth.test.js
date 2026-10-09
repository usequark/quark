import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	getAppleClientIds,
	getGoogleClientId,
	isAppleAuthEnabled,
	isAudienceValid,
	isGoogleAuthEnabled,
} from "./oauth.js";

describe("OAuth config - provider enablement", () => {
	let savedEnv;

	beforeEach(() => {
		savedEnv = { ...process.env };
		delete process.env.GOOGLE_CLIENT_ID;
		delete process.env.APPLE_CLIENT_ID;
	});

	afterEach(() => {
		for (const key of ["GOOGLE_CLIENT_ID", "APPLE_CLIENT_ID"]) {
			if (savedEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = savedEnv[key];
			}
		}
	});

	test("reports both providers off when nothing is configured", () => {
		// The default state for every app that does not use social sign-in. If
		// this ever reported "enabled", every Quark deployment would claim to
		// offer Google login it has no credentials for.
		assert.strictEqual(isGoogleAuthEnabled(), false);
		assert.strictEqual(isAppleAuthEnabled(), false);
		assert.strictEqual(getGoogleClientId(), undefined);
		assert.strictEqual(getAppleClientIds(), undefined);
	});

	test("reports Google on when only its client id is set", () => {
		// The two are independent: the client id alone is what the auth route
		// needs to verify the token audience. NextAuth additionally wants the
		// secret to render a sign-in button, but that is auth.js's concern and
		// does not gate the route.
		process.env.GOOGLE_CLIENT_ID =
			"google-client-id.apps.googleusercontent.com";

		assert.strictEqual(isGoogleAuthEnabled(), true);
		assert.strictEqual(
			getGoogleClientId(),
			"google-client-id.apps.googleusercontent.com",
		);
	});

	test("does not let a Google client id enable Apple", () => {
		process.env.GOOGLE_CLIENT_ID = "google-client-id";

		assert.strictEqual(isAppleAuthEnabled(), false);
	});

	test("trims the client id it hands back", () => {
		// A trailing newline in a .env file or a Railway variable is a routine
		// mistake. An untrimmed value would fail every audience comparison and
		// present as "Google sign-in is broken" with nothing pointing at the cause.
		process.env.GOOGLE_CLIENT_ID = "  google-client-id  ";

		assert.strictEqual(getGoogleClientId(), "google-client-id");
		assert.strictEqual(
			isAudienceValid("google-client-id", getGoogleClientId()),
			true,
		);
	});

	test("treats a blank client id as not configured", () => {
		// An operator clearing the variable in a dashboard can leave it present
		// but empty. Reading that as "configured" would compare every token
		// against the empty string and reject all of them, turning the
		// fail-closed refusal into a confusing 401 instead of a clear "off".
		process.env.GOOGLE_CLIENT_ID = "";
		assert.strictEqual(isGoogleAuthEnabled(), false);

		process.env.GOOGLE_CLIENT_ID = "   ";
		assert.strictEqual(isGoogleAuthEnabled(), false);
		assert.strictEqual(getGoogleClientId(), undefined);
	});

	test("reads Apple independently of Google", () => {
		process.env.APPLE_CLIENT_ID = "com.example.web";

		assert.strictEqual(isAppleAuthEnabled(), true);
		assert.strictEqual(isGoogleAuthEnabled(), false);
	});

	test("reads a single Apple audience as a one-element list", () => {
		process.env.APPLE_CLIENT_ID = "com.example.web";

		assert.deepStrictEqual(getAppleClientIds(), ["com.example.web"]);
	});

	test("reads multiple comma-separated Apple audiences", () => {
		// Apple identity tokens carry *either* the bundle identifier (native
		// iOS) *or* the Services ID (web flow) as their `aud` claim, depending on
		// which flow the client uses. Both must be accepted.
		process.env.APPLE_CLIENT_ID = "com.example.web, com.example.app";

		assert.deepStrictEqual(getAppleClientIds(), [
			"com.example.web",
			"com.example.app",
		]);
	});

	test("trims whitespace around each Apple audience", () => {
		process.env.APPLE_CLIENT_ID = "  com.example.web ,  com.example.app  ";

		assert.deepStrictEqual(getAppleClientIds(), [
			"com.example.web",
			"com.example.app",
		]);
	});

	test("drops blank entries from the Apple audience list", () => {
		// A trailing comma or a doubled separator is a routine .env mistake.
		// Counting a blank entry as an audience would make the list non-empty
		// and report the provider as configured with nothing to compare against.
		process.env.APPLE_CLIENT_ID = "com.example.web,, ";

		assert.deepStrictEqual(getAppleClientIds(), ["com.example.web"]);
	});

	test("treats a comma-only Apple value as unconfigured", () => {
		process.env.APPLE_CLIENT_ID = " , ";

		assert.strictEqual(getAppleClientIds(), undefined);
		assert.strictEqual(isAppleAuthEnabled(), false);
	});
});

describe("OAuth config - audience comparison", () => {
	test("accepts a token minted for this client id", () => {
		assert.strictEqual(
			isAudienceValid("quark-client-id", "quark-client-id"),
			true,
		);
	});

	test("rejects a token minted for a different app", () => {
		// The token is genuine and its signature checks out — Google issued it.
		// It was just issued to somebody else's application, which is the whole
		// reason the audience claim exists.
		assert.strictEqual(
			isAudienceValid("some-other-apps-client-id", "quark-client-id"),
			false,
		);
	});

	test("rejects a missing or non-string audience", () => {
		// tokeninfo omits `aud` on some error shapes. A missing claim must not
		// compare equal to the configured id by falling through to a truthy check.
		assert.strictEqual(isAudienceValid(undefined, "quark-client-id"), false);
		assert.strictEqual(isAudienceValid(null, "quark-client-id"), false);
		assert.strictEqual(isAudienceValid("", "quark-client-id"), false);
		assert.strictEqual(isAudienceValid(123, "quark-client-id"), false);
		assert.strictEqual(
			isAudienceValid({ aud: "quark-client-id" }, "quark-client-id"),
			false,
		);
	});

	test("rejects everything when no client id is configured", () => {
		// Defensive: if a route ever reaches the comparison while unconfigured,
		// the answer is "reject" rather than "accept anything". A caller that
		// forgets to gate on enablement fails closed instead of failing open.
		assert.strictEqual(isAudienceValid("anything-at-all", undefined), false);
		assert.strictEqual(isAudienceValid("anything-at-all", ""), false);
		assert.strictEqual(isAudienceValid("anything-at-all", "   "), false);
	});

	test("accepts any audience in a multi-id list", () => {
		// Apple passes the full list from getAppleClientIds() so both the bundle
		// identifier and the Services ID are valid.
		const audiences = ["com.example.web", "com.example.app"];

		assert.strictEqual(isAudienceValid("com.example.web", audiences), true);
		assert.strictEqual(isAudienceValid("com.example.app", audiences), true);
		assert.strictEqual(isAudienceValid("com.other.app", audiences), false);
	});

	test("rejects an empty audience list", () => {
		// An empty list means "no audiences configured" — the same as undefined.
		assert.strictEqual(isAudienceValid("com.example.web", []), false);
	});

	test("rejects a missing or non-string audience against a list", () => {
		const audiences = ["com.example.web", "com.example.app"];

		assert.strictEqual(isAudienceValid(undefined, audiences), false);
		assert.strictEqual(isAudienceValid(null, audiences), false);
		assert.strictEqual(isAudienceValid("", audiences), false);
		assert.strictEqual(isAudienceValid(123, audiences), false);
	});
});
