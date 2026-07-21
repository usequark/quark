import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	authorization,
	createAuthorization,
	defaultPolicy,
	requireRole,
	withAuthorization,
} from "./authorization.js";
import { ForbiddenError } from "./errors.js";

describe("authorization", () => {
	/** @type {ReturnType<typeof createAuthorization>} */
	let auth;

	beforeEach(() => {
		auth = createAuthorization();
	});

	describe("can()", () => {
		it("returns true for admin with wildcard permissions", () => {
			const user = { id: "u1", role: "admin" };
			assert.equal(auth.can(user, "create", "post"), true);
			assert.equal(auth.can(user, "delete", "user"), true);
			assert.equal(auth.can(user, "anything", "anywhere"), true);
		});

		it("returns true for editor with post actions", () => {
			const user = { id: "u2", role: "editor" };
			assert.equal(auth.can(user, "create", "post"), true);
			assert.equal(auth.can(user, "update", "post"), true);
			assert.equal(auth.can(user, "delete", "post"), true);
			assert.equal(auth.can(user, "read", "post"), true);
		});

		it("returns true for editor reading users", () => {
			const user = { id: "u2", role: "editor" };
			assert.equal(auth.can(user, "read", "user"), true);
		});

		it("returns false for editor trying to delete users", () => {
			const user = { id: "u2", role: "editor" };
			assert.equal(auth.can(user, "delete", "user"), false);
		});

		it("returns false for viewer trying to write", () => {
			const user = { id: "u3", role: "viewer" };
			assert.equal(auth.can(user, "create", "post"), false);
			assert.equal(auth.can(user, "update", "post"), false);
			assert.equal(auth.can(user, "delete", "post"), false);
		});

		it("returns true for viewer reading posts and users", () => {
			const user = { id: "u3", role: "viewer" };
			assert.equal(auth.can(user, "read", "post"), true);
			assert.equal(auth.can(user, "read", "user"), true);
		});

		it("owner can update their own resource", () => {
			const user = { id: "u3", role: "viewer" };
			const context = { ownerId: "u3" };
			assert.equal(auth.can(user, "update", "post", context), true);
		});

		it("owner can delete their own resource", () => {
			const user = { id: "u3", role: "viewer" };
			const context = { ownerId: "u3" };
			assert.equal(auth.can(user, "delete", "post", context), true);
		});

		it("non-owner cannot update another user's resource", () => {
			const user = { id: "u3", role: "viewer" };
			const context = { ownerId: "u999" };
			assert.equal(auth.can(user, "update", "post", context), false);
		});

		it("ownership does not apply for non-owner actions", () => {
			const user = { id: "u3", role: "viewer" };
			const context = { ownerId: "u3" };
			// "create" is not in ownerActions by default
			assert.equal(auth.can(user, "create", "post", context), false);
		});

		it("applies defaultRole when user has no role", () => {
			const user = { id: "u4" };
			// defaultRole is "viewer" - can read but not create
			assert.equal(auth.can(user, "read", "post"), true);
			assert.equal(auth.can(user, "create", "post"), false);
		});
	});

	describe("authorize()", () => {
		it("throws ForbiddenError when denied", () => {
			const user = { id: "u3", role: "viewer" };
			assert.throws(
				() => auth.authorize(user, "create", "post"),
				(err) => err instanceof ForbiddenError,
			);
		});

		it("does not throw when allowed", () => {
			const user = { id: "u1", role: "admin" };
			assert.doesNotThrow(() => auth.authorize(user, "create", "post"));
		});

		it("includes user and action information in error message", () => {
			const user = { id: "u3", role: "viewer" };
			assert.throws(() => auth.authorize(user, "create", "post"), {
				message: "User u3 is not allowed to create post",
			});
		});
	});

	describe("hasPermission()", () => {
		it("returns true for exact match", () => {
			assert.equal(auth.hasPermission("viewer", "read", "post"), true);
			assert.equal(auth.hasPermission("viewer", "read", "user"), true);
		});

		it("returns false for no match", () => {
			assert.equal(auth.hasPermission("viewer", "create", "post"), false);
		});

		it("returns true with resource wildcard", () => {
			assert.equal(auth.hasPermission("admin", "create", "anything"), true);
		});

		it("returns true with action wildcard", () => {
			assert.equal(auth.hasPermission("editor", "delete", "post"), true);
		});

		it("returns false for unknown role", () => {
			assert.equal(auth.hasPermission("unknown", "read", "post"), false);
		});
	});

	describe("getRolePermissions()", () => {
		it("returns permissions for a valid role", () => {
			const perms = auth.getRolePermissions("viewer");
			assert.deepStrictEqual(perms, [
				{ resource: "post", action: "read" },
				{ resource: "user", action: "read" },
			]);
		});

		it("returns empty array for unknown role", () => {
			const perms = auth.getRolePermissions("nonexistent");
			assert.deepStrictEqual(perms, []);
		});
	});

	describe("addRole() and removeRole()", () => {
		it("addRole() makes new role available", () => {
			auth.addRole("moderator", [
				{ resource: "post", action: "update" },
				{ resource: "post", action: "delete" },
			]);
			const user = { id: "u5", role: "moderator" };
			assert.equal(auth.can(user, "update", "post"), true);
			assert.equal(auth.can(user, "delete", "post"), true);
			assert.equal(auth.can(user, "create", "post"), false);
		});

		it("removeRole() removes a role", () => {
			auth.removeRole("editor");
			assert.deepStrictEqual(auth.getRolePermissions("editor"), []);
			assert.equal(auth.hasPermission("editor", "read", "post"), false);
		});
	});

	describe("extendPolicy()", () => {
		it("merges new roles into existing policy", () => {
			auth.extendPolicy({
				roles: {
					supermod: {
						permissions: [{ resource: "*", action: "delete" }],
					},
				},
			});

			const user = { id: "u6", role: "supermod" };
			assert.equal(auth.can(user, "delete", "post"), true);
			assert.equal(auth.can(user, "delete", "user"), true);
			assert.equal(auth.can(user, "create", "post"), false);
		});

		it("preserves existing roles when extending", () => {
			auth.extendPolicy({
				roles: {
					custom: {
						permissions: [{ resource: "report", action: "read" }],
					},
				},
			});
			// Original roles still work
			assert.equal(auth.hasPermission("admin", "create", "post"), true);
			assert.equal(auth.hasPermission("viewer", "read", "post"), true);
		});

		it("can override defaultRole", () => {
			auth.extendPolicy({ defaultRole: "editor" });
			const user = { id: "u7" };
			assert.equal(auth.can(user, "create", "post"), true);
		});
	});

	describe("requireRole()", () => {
		it("does not throw when session user has an allowed role", () => {
			const guard = requireRole("admin", "editor");
			const session = { user: { id: "u1", role: "admin" } };
			assert.doesNotThrow(() => guard(session));
		});

		it("throws ForbiddenError when session user role is not allowed", () => {
			const guard = requireRole("admin");
			const session = { user: { id: "u2", role: "viewer" } };
			assert.throws(
				() => guard(session),
				(err) => err instanceof ForbiddenError,
			);
		});

		it("throws ForbiddenError when session has no role", () => {
			const guard = requireRole("admin");
			const session = { user: { id: "u2" } };
			assert.throws(
				() => guard(session),
				(err) => err instanceof ForbiddenError,
			);
		});

		it("throws ForbiddenError when session has no user", () => {
			const guard = requireRole("admin");
			assert.throws(
				() => guard({}),
				(err) => err instanceof ForbiddenError,
			);
		});
	});

	describe("withAuthorization()", () => {
		it("calls handler when authorized", async () => {
			let called = false;
			const handler = (_req, _session) => {
				called = true;
				return "ok";
			};
			const wrapped = withAuthorization(handler, {
				action: "read",
				resource: "post",
			});
			const session = { user: { id: "u1", role: "admin" } };
			const result = await wrapped({}, session);
			assert.equal(called, true);
			assert.equal(result, "ok");
		});

		it("throws ForbiddenError when not authorized", async () => {
			const handler = () => "ok";
			const wrapped = withAuthorization(handler, {
				action: "create",
				resource: "post",
			});
			const session = { user: { id: "u3", role: "viewer" } };
			await assert.rejects(() => wrapped({}, session), ForbiddenError);
		});

		it("throws ForbiddenError when no user in session", async () => {
			const handler = () => "ok";
			const wrapped = withAuthorization(handler, {
				action: "read",
				resource: "post",
			});
			await assert.rejects(() => wrapped({}, {}), ForbiddenError);
		});

		it("passes context from getContext to authorization", async () => {
			const handler = () => "ok";
			const wrapped = withAuthorization(handler, {
				action: "update",
				resource: "post",
				getContext: () => ({ ownerId: "owner1" }),
			});
			// viewer can update own resource via ownership
			const session = { user: { id: "owner1", role: "viewer" } };
			const result = await wrapped({}, session);
			assert.equal(result, "ok");
		});
	});

	describe("default instance", () => {
		it("exports a working default authorization instance", () => {
			assert.equal(
				authorization.can({ id: "u1", role: "admin" }, "create", "post"),
				true,
			);
			assert.equal(
				authorization.can({ id: "u1", role: "viewer" }, "create", "post"),
				false,
			);
		});
	});

	describe("defaultPolicy", () => {
		it("is exported and has expected structure", () => {
			assert.ok(defaultPolicy.roles.admin);
			assert.ok(defaultPolicy.roles.editor);
			assert.ok(defaultPolicy.roles.viewer);
			assert.equal(defaultPolicy.defaultRole, "viewer");
			assert.equal(defaultPolicy.ownershipField, "ownerId");
			assert.deepStrictEqual(defaultPolicy.ownerActions, ["update", "delete"]);
		});
	});
});
