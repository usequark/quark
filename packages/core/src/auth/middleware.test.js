import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenError, UnauthorizedError } from "../errors.js";
import {
	createAuthMiddleware,
	requireSession,
	requireSessionRole,
} from "./middleware.js";

// ---------------------------------------------------------------------------
// requireSession
// ---------------------------------------------------------------------------

test("auth/middleware - requireSession returns session when valid", async () => {
	const session = { user: { id: "1", email: "a@b.com" } };
	const result = await requireSession(async () => session);
	assert.deepEqual(result, session);
});

test("auth/middleware - requireSession throws UnauthorizedError when session is null", async () => {
	await assert.rejects(
		() => requireSession(async () => null),
		(err) => err instanceof UnauthorizedError,
	);
});

test("auth/middleware - requireSession throws UnauthorizedError when session is undefined", async () => {
	await assert.rejects(
		() => requireSession(async () => undefined),
		(err) => err instanceof UnauthorizedError,
	);
});

// ---------------------------------------------------------------------------
// requireSessionRole
// ---------------------------------------------------------------------------

test("auth/middleware - requireSessionRole returns session when role matches", async () => {
	const session = { user: { id: "1", role: "admin" } };
	const result = await requireSessionRole("admin", async () => session);
	assert.deepEqual(result, session);
});

test("auth/middleware - requireSessionRole is case-insensitive", async () => {
	const session = { user: { id: "1", role: "Admin" } };
	const result = await requireSessionRole("admin", async () => session);
	assert.deepEqual(result, session);
});

test("auth/middleware - requireSessionRole throws ForbiddenError when role does not match", async () => {
	const session = { user: { id: "1", role: "viewer" } };
	await assert.rejects(
		() => requireSessionRole("admin", async () => session),
		(err) => err instanceof ForbiddenError,
	);
});

test("auth/middleware - requireSessionRole throws UnauthorizedError when session is null", async () => {
	await assert.rejects(
		() => requireSessionRole("admin", async () => null),
		(err) => err instanceof UnauthorizedError,
	);
});

test("auth/middleware - requireSessionRole throws ForbiddenError when user has no role", async () => {
	const session = { user: { id: "1" } };
	await assert.rejects(
		() => requireSessionRole("admin", async () => session),
		(err) => err instanceof ForbiddenError,
	);
});

// ---------------------------------------------------------------------------
// createAuthMiddleware
// ---------------------------------------------------------------------------

test("auth/middleware - createAuthMiddleware requireSession works", async () => {
	const session = { user: { id: "42", role: "editor" } };
	const mw = createAuthMiddleware({ getSession: async () => session });
	const result = await mw.requireSession();
	assert.deepEqual(result, session);
});

test("auth/middleware - createAuthMiddleware requireSession throws on null session", async () => {
	const mw = createAuthMiddleware({ getSession: async () => null });
	await assert.rejects(
		() => mw.requireSession(),
		(err) => err instanceof UnauthorizedError,
	);
});

test("auth/middleware - createAuthMiddleware requireSessionRole works", async () => {
	const session = { user: { id: "42", role: "admin" } };
	const mw = createAuthMiddleware({ getSession: async () => session });
	const result = await mw.requireSessionRole("admin");
	assert.deepEqual(result, session);
});

test("auth/middleware - createAuthMiddleware requireSessionRole throws ForbiddenError", async () => {
	const session = { user: { id: "42", role: "viewer" } };
	const mw = createAuthMiddleware({ getSession: async () => session });
	await assert.rejects(
		() => mw.requireSessionRole("admin"),
		(err) => err instanceof ForbiddenError,
	);
});

test("auth/middleware - createAuthMiddleware uses custom roleField", async () => {
	const flatSession = { user: { id: "42", accessLevel: "admin" } };
	const mw = createAuthMiddleware({
		getSession: async () => flatSession,
		roleField: "accessLevel",
	});
	const result = await mw.requireSessionRole("admin");
	assert.deepEqual(result, flatSession);
});
