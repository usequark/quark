import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

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

test("inline script stays valid if minification drops the function name", () => {
	// Production bundlers stripped `shouldBlockUmamiPayload` down to an
	// anonymous `function({...})`, which as a bare statement is a SyntaxError
	// that kills the whole inline tag. The `var` assignment must hold for
	// named, anonymous, and arrow shapes alike.
	const minifiedShape = buildUmamiBeforeSendScript().replace(
		"function shouldBlockUmamiPayload",
		"function",
	);
	assert.doesNotThrow(() => {
		new Function(minifiedShape);
	});
});

test("inline script defines a working hook when executed", () => {
	// URL is a browser global but absent from bare vm contexts.
	const sandbox = { window: {}, document: { cookie: "" }, URL };
	vm.createContext(sandbox);
	vm.runInContext(buildUmamiBeforeSendScript(), sandbox);

	const hook = sandbox.window.__umamiBeforeSend;
	assert.equal(typeof hook, "function");

	// Admin URLs are dropped (hook returns false).
	assert.equal(hook(null, { url: "https://x.test/admin" }), false);
	// Public URLs pass the payload through.
	const payload = { url: "https://x.test/pricing" };
	assert.equal(hook(null, payload), payload);
	// Staff cookies drop everything.
	sandbox.document.cookie = "umami_user_role=admin";
	assert.equal(hook(null, { url: "https://x.test/" }), false);
});
