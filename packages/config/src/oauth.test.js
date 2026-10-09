import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	getAppleClientId,
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
		assert.strictEqual(getAppleClientId(), undefined);
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
});
