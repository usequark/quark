import assert from "node:assert/strict";
import test from "node:test";

import {
	buildUmamiBeforeSendScript,
	shouldBlockUmamiPayload,
} from "./umami-before-send.js";

test("shouldBlockUmamiPayload blocks when roleCookie is present", () => {
	assert.equal(
		shouldBlockUmamiPayload({
			url: "https://example.com/",
			roleCookie: "admin",
		}),
		true,
	);
	assert.equal(
		shouldBlockUmamiPayload({
			url: "https://example.com/",
			roleCookie: "lead_dev",
		}),
		true,
	);
	assert.equal(
		shouldBlockUmamiPayload({
			url: "https://example.com/",
			roleCookie: "viewer",
		}),
		true,
	);
});

test("shouldBlockUmamiPayload blocks /admin pathname (absolute URL)", () => {
	assert.equal(
		shouldBlockUmamiPayload({
			url: "https://example.com/admin",
			roleCookie: null,
		}),
		true,
	);
	assert.equal(
		shouldBlockUmamiPayload({
			url: "https://example.com/admin/users",
			roleCookie: "",
		}),
		true,
	);
});

test("shouldBlockUmamiPayload allows non-admin public URL", () => {
	assert.equal(
		shouldBlockUmamiPayload({
			url: "https://example.com/pricing",
			roleCookie: null,
		}),
		false,
	);
	assert.equal(
		shouldBlockUmamiPayload({
			url: "https://example.com/",
			roleCookie: undefined,
		}),
		false,
	);
});

test("shouldBlockUmamiPayload does not throw on relative URL and blocks /admin", () => {
	assert.doesNotThrow(() => {
		shouldBlockUmamiPayload({ url: "/admin/settings", roleCookie: null });
	});
	assert.equal(
		shouldBlockUmamiPayload({ url: "/admin/settings", roleCookie: null }),
		true,
	);
	assert.equal(
		shouldBlockUmamiPayload({ url: "/pricing", roleCookie: null }),
		false,
	);
});

test("shouldBlockUmamiPayload does not throw on malformed URL", () => {
	assert.doesNotThrow(() => {
		shouldBlockUmamiPayload({ url: "://bad", roleCookie: null });
	});
	// new URL("://bad", base) still throws in some engines; either way must not throw
	// and must not block (return false)
	assert.equal(
		shouldBlockUmamiPayload({ url: "://bad", roleCookie: null }),
		false,
	);
});

test("shouldBlockUmamiPayload allows empty url", () => {
	assert.equal(shouldBlockUmamiPayload({ url: "", roleCookie: null }), false);
	assert.equal(shouldBlockUmamiPayload({ roleCookie: null }), false);
	assert.equal(shouldBlockUmamiPayload({}), false);
});

test("buildUmamiBeforeSendScript output is valid JS defining __umamiBeforeSend", () => {
	const script = buildUmamiBeforeSendScript();
	assert.equal(typeof script, "string");
	assert.ok(script.includes("__umamiBeforeSend"));
	assert.ok(script.includes("shouldBlockUmamiPayload"));
	assert.doesNotThrow(() => {
		// Syntax check only — do not execute against real document
		new Function(script);
	});
});
