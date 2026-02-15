import assert from "node:assert";
import { test } from "node:test";
import { passwordResetEmail, welcomeEmail } from "./email-templates.js";

test("welcomeEmail", async (t) => {
	await t.test("returns subject, html, and text", () => {
		const result = welcomeEmail({});
		assert.ok(result.subject);
		assert.ok(result.html);
		assert.ok(result.text);
	});

	await t.test("uses default app name in subject", () => {
		const result = welcomeEmail({});
		assert.strictEqual(result.subject, "Welcome to Quark!");
	});

	await t.test("uses custom app name in subject", () => {
		const result = welcomeEmail({ appName: "MyApp" });
		assert.strictEqual(result.subject, "Welcome to MyApp!");
	});

	await t.test("includes user name in html when provided", () => {
		const result = welcomeEmail({ name: "Alice" });
		assert.ok(result.html.includes("Alice"));
		assert.ok(result.text.includes("Alice"));
	});

	await t.test("uses fallback greeting when no name provided", () => {
		const result = welcomeEmail({});
		assert.ok(result.html.includes("there"));
		assert.ok(result.text.includes("there"));
	});

	await t.test("includes login URL when provided", () => {
		const result = welcomeEmail({ loginUrl: "https://app.test/login" });
		assert.ok(result.html.includes("https://app.test/login"));
		assert.ok(result.text.includes("https://app.test/login"));
	});

	await t.test("omits sign-in button when no login URL", () => {
		const result = welcomeEmail({});
		assert.ok(!result.html.includes("Sign In"));
	});

	await t.test("escapes HTML in user name", () => {
		const result = welcomeEmail({ name: "<script>alert('xss')</script>" });
		assert.ok(!result.html.includes("<script>"));
		assert.ok(result.html.includes("&lt;script&gt;"));
	});

	await t.test("wraps content in html layout", () => {
		const result = welcomeEmail({});
		assert.ok(result.html.includes("<!DOCTYPE html>"));
		assert.ok(result.html.includes("</html>"));
	});
});

test("passwordResetEmail", async (t) => {
	const validArgs = { resetUrl: "https://app.test/reset?token=abc123" };

	await t.test("returns subject, html, and text", () => {
		const result = passwordResetEmail(validArgs);
		assert.ok(result.subject);
		assert.ok(result.html);
		assert.ok(result.text);
	});

	await t.test("throws when resetUrl is missing", () => {
		assert.throws(() => passwordResetEmail({}), /resetUrl is required/);
	});

	await t.test("includes reset URL in html and text", () => {
		const result = passwordResetEmail(validArgs);
		assert.ok(result.html.includes(validArgs.resetUrl));
		assert.ok(result.text.includes(validArgs.resetUrl));
	});

	await t.test("uses default app name", () => {
		const result = passwordResetEmail(validArgs);
		assert.ok(result.subject.includes("Quark"));
	});

	await t.test("uses custom app name", () => {
		const result = passwordResetEmail({ ...validArgs, appName: "MyApp" });
		assert.ok(result.subject.includes("MyApp"));
	});

	await t.test("includes user name when provided", () => {
		const result = passwordResetEmail({ ...validArgs, name: "Bob" });
		assert.ok(result.html.includes("Bob"));
		assert.ok(result.text.includes("Bob"));
	});

	await t.test("uses default expiry time", () => {
		const result = passwordResetEmail(validArgs);
		assert.ok(result.html.includes("1 hour"));
		assert.ok(result.text.includes("1 hour"));
	});

	await t.test("uses custom expiry time", () => {
		const result = passwordResetEmail({
			...validArgs,
			expiresIn: "30 minutes",
		});
		assert.ok(result.html.includes("30 minutes"));
		assert.ok(result.text.includes("30 minutes"));
	});

	await t.test("escapes HTML in user name", () => {
		const result = passwordResetEmail({
			...validArgs,
			name: '<img src=x onerror="alert(1)">',
		});
		assert.ok(!result.html.includes("<img"));
		assert.ok(result.html.includes("&lt;img"));
	});

	await t.test("wraps content in html layout", () => {
		const result = passwordResetEmail(validArgs);
		assert.ok(result.html.includes("<!DOCTYPE html>"));
		assert.ok(result.html.includes("</html>"));
	});
});
