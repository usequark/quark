import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenError, UnauthorizedError } from "@techstream/quark-core";

import { requireAuth, requireRole } from "./auth-middleware.js";

/**
 * next-auth 5.0.0-beta.31 returned the *error body* of a 500 as though it were
 * a session: "Returning that object as the session would make truthiness checks
 * like `!!auth` pass for everyone, failing open." beta.32 added
 * `parseSessionResponse` to fix the source, but the guard must not depend on a
 * pre-release library behaving correctly - a beta bump is all it takes to fail
 * open again. These tests pin the guard's own behaviour, passing the session in
 * directly so no NextAuth instance is constructed.
 */

// The exact shape beta.31 could hand back on a misconfigured provider.
const ERROR_BODY_SESSION = {
	message: "There was a problem with the server configuration",
};

test("requireAuth rejects a null session", async () => {
	await assert.rejects(() => requireAuth(null), UnauthorizedError);
});

test("requireAuth rejects the error body beta.31 could return", async () => {
	// A truthy object with no `user`: the case that defeated `if (!session)`.
	await assert.rejects(
		() => requireAuth(ERROR_BODY_SESSION),
		UnauthorizedError,
	);
});

test("requireAuth rejects a session with no user", async () => {
	await assert.rejects(
		() => requireAuth({ expires: "2099-01-01" }),
		UnauthorizedError,
	);
});

test("requireAuth rejects a user with no identity", async () => {
	await assert.rejects(
		() => requireAuth({ user: { name: "No Id", email: "n@example.test" } }),
		UnauthorizedError,
	);
});

test("requireAuth rejects a non-object user", async () => {
	await assert.rejects(() => requireAuth({ user: "admin" }), UnauthorizedError);
});

test("requireAuth rejects an empty-string id", async () => {
	await assert.rejects(
		() => requireAuth({ user: { id: "" } }),
		UnauthorizedError,
	);
});

test("requireAuth rejects a non-string id", async () => {
	// A numeric 0 is truthy, so the old guard would have accepted it.
	await assert.rejects(
		() => requireAuth({ user: { id: 0 } }),
		UnauthorizedError,
	);
});

test("requireAuth accepts a session with a user id", async () => {
	const session = { user: { id: "user-1", role: "admin" } };
	assert.equal(await requireAuth(session), session);
});

test("requireAuth accepts a session identified by sub", async () => {
	const session = { user: { sub: "user-2", role: "editor" } };
	assert.equal(await requireAuth(session), session);
});

test("requireRole returns the session when the role matches", async () => {
	const session = { user: { id: "user-3", role: "admin" } };
	assert.equal(await requireRole("admin", session), session);
});

test("requireRole throws Forbidden when the role does not match", async () => {
	await assert.rejects(
		() => requireRole("admin", { user: { id: "user-4", role: "editor" } }),
		ForbiddenError,
	);
});

test("requireRole fails closed on the error body, not open", async () => {
	// The critical regression: beta.31's error body reached requireRole as a
	// truthy session. It must surface as Unauthorized, never as an admin.
	await assert.rejects(
		() => requireRole("admin", ERROR_BODY_SESSION),
		UnauthorizedError,
	);
});
