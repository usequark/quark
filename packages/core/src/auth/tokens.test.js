import assert from "node:assert";
import { describe, test } from "node:test";
import { DEFAULT_TOKEN_BYTES, generateToken, hashToken } from "./tokens.js";

describe("generateToken", () => {
	test("returns a hex string of 2 characters per byte", () => {
		const token = generateToken();
		assert.match(token, /^[0-9a-f]+$/);
		assert.strictEqual(token.length, DEFAULT_TOKEN_BYTES * 2);
	});

	test("honours a custom byte length", () => {
		assert.strictEqual(generateToken(16).length, 32);
	});

	test("does not repeat across calls", () => {
		// A token used as a one-time link must not collide with another. 32 bytes
		// makes a repeat effectively impossible; a regression to a counter, a
		// timestamp, or a constant would surface here immediately.
		const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
		assert.strictEqual(tokens.size, 100);
	});
});

describe("hashToken", () => {
	test("is deterministic", () => {
		assert.strictEqual(hashToken("abc"), hashToken("abc"));
	});

	test("produces a 64-character hex digest", () => {
		assert.match(hashToken("abc"), /^[0-9a-f]{64}$/);
	});

	test("separates different inputs", () => {
		assert.notStrictEqual(hashToken("abc"), hashToken("abd"));
	});

	test("does not embed the raw token", () => {
		const token = "super-secret-reset-token";
		assert.ok(!hashToken(token).includes(token));
	});
});
