/**
 * @techstream/quark-core - Authorization Module
 * Policy-based, schema-agnostic RBAC engine
 */

import { ForbiddenError } from "./errors.js";

/**
 * @typedef {{ resource: string, action: string }} Permission
 * @typedef {{ permissions: Permission[] }} RoleDefinition
 * @typedef {{
 *   roles: Record<string, RoleDefinition>,
 *   defaultRole: string,
 *   ownershipField: string,
 *   ownerActions: string[]
 * }} Policy
 * @typedef {{ id: string, role?: string }} AuthUser
 */

/**
 * Default policy shipped with Quark - easily overridable by downstream projects.
 * @type {Policy}
 */
export const defaultPolicy = {
	roles: {
		admin: {
			permissions: [{ resource: "*", action: "*" }],
		},
		editor: {
			permissions: [
				{ resource: "post", action: "*" },
				{ resource: "user", action: "read" },
			],
		},
		viewer: {
			permissions: [
				{ resource: "post", action: "read" },
				{ resource: "user", action: "read" },
			],
		},
	},
	defaultRole: "viewer",
	ownershipField: "ownerId",
	ownerActions: ["update", "delete"],
};

/**
 * Creates an authorization instance from a policy configuration.
 * @param {Policy} [policy] - The policy to use (defaults to `defaultPolicy`)
 * @returns {{
 *   can: (user: AuthUser, action: string, resource: string, context?: Record<string, unknown>) => boolean,
 *   authorize: (user: AuthUser, action: string, resource: string, context?: Record<string, unknown>) => void,
 *   hasPermission: (role: string, action: string, resource: string) => boolean,
 *   getRolePermissions: (role: string) => Permission[],
 *   addRole: (name: string, permissions: Permission[]) => void,
 *   removeRole: (name: string) => void,
 *   extendPolicy: (policyExtension: Partial<Policy>) => void
 * }}
 */
export const createAuthorization = (policy = defaultPolicy) => {
	const _policy = structuredClone(policy);

	/**
	 * Checks whether a role has a specific permission, respecting wildcards.
	 * @param {string} role - Role name
	 * @param {string} action - Action to check (e.g. "read", "update")
	 * @param {string} resource - Resource to check (e.g. "post", "user")
	 * @returns {boolean}
	 */
	const hasPermission = (role, action, resource) => {
		const roleDef = _policy.roles[role];
		if (!roleDef) return false;

		return roleDef.permissions.some((perm) => {
			const resourceMatch = perm.resource === "*" || perm.resource === resource;
			const actionMatch = perm.action === "*" || perm.action === action;
			return resourceMatch && actionMatch;
		});
	};

	/**
	 * Returns the permissions array for a given role.
	 * @param {string} role - Role name
	 * @returns {Permission[]} Array of permissions, or empty array if role not found
	 */
	const getRolePermissions = (role) => {
		const roleDef = _policy.roles[role];
		return roleDef ? [...roleDef.permissions] : [];
	};

	/**
	 * Checks whether a user is allowed to perform an action on a resource.
	 * Supports role-based permissions and ownership checks.
	 * @param {AuthUser} user - User object with `id` and optional `role`
	 * @param {string} action - Action to perform
	 * @param {string} resource - Target resource
	 * @param {Record<string, unknown>} [context] - Optional context for ownership checks
	 * @returns {boolean}
	 */
	const can = (user, action, resource, context) => {
		const role = user.role || _policy.defaultRole;

		if (hasPermission(role, action, resource)) {
			return true;
		}

		// Ownership check
		if (
			context &&
			_policy.ownerActions.includes(action) &&
			context[_policy.ownershipField] != null &&
			context[_policy.ownershipField] === user.id
		) {
			return true;
		}

		return false;
	};

	/**
	 * Same as `can()` but throws `ForbiddenError` when access is denied.
	 * @param {AuthUser} user - User object with `id` and optional `role`
	 * @param {string} action - Action to perform
	 * @param {string} resource - Target resource
	 * @param {Record<string, unknown>} [context] - Optional context for ownership checks
	 * @throws {ForbiddenError}
	 */
	const authorize = (user, action, resource, context) => {
		if (!can(user, action, resource, context)) {
			throw new ForbiddenError(
				`User ${user.id} is not allowed to ${action} ${resource}`,
			);
		}
	};

	/**
	 * Dynamically adds a role to the current policy.
	 * @param {string} name - Role name
	 * @param {Permission[]} permissions - Permissions for the role
	 */
	const addRole = (name, permissions) => {
		_policy.roles[name] = { permissions: [...permissions] };
	};

	/**
	 * Removes a role from the current policy.
	 * @param {string} name - Role name to remove
	 */
	const removeRole = (name) => {
		delete _policy.roles[name];
	};

	/**
	 * Merges additional roles and settings into the current policy.
	 * @param {Partial<Policy>} policyExtension - Partial policy to merge
	 */
	const extendPolicy = (policyExtension) => {
		if (policyExtension.roles) {
			for (const [name, roleDef] of Object.entries(policyExtension.roles)) {
				_policy.roles[name] = structuredClone(roleDef);
			}
		}
		if (policyExtension.defaultRole !== undefined) {
			_policy.defaultRole = policyExtension.defaultRole;
		}
		if (policyExtension.ownershipField !== undefined) {
			_policy.ownershipField = policyExtension.ownershipField;
		}
		if (policyExtension.ownerActions !== undefined) {
			_policy.ownerActions = [...policyExtension.ownerActions];
		}
	};

	return {
		can,
		authorize,
		hasPermission,
		getRolePermissions,
		addRole,
		removeRole,
		extendPolicy,
	};
};

/** Default authorization instance using the default policy. */
export const authorization = createAuthorization();

/**
 * Higher-order function that returns a guard checking if the session user
 * has one of the specified roles. Throws `ForbiddenError` if not.
 * @param {...string} roles - Allowed role names
 * @returns {(session: { user: AuthUser }) => void}
 */
export const requireRole = (...roles) => {
	/**
	 * @param {{ user: AuthUser }} session
	 * @throws {ForbiddenError}
	 */
	return (session) => {
		const userRole = session?.user?.role;
		if (!userRole || !roles.includes(userRole)) {
			throw new ForbiddenError(
				`Role ${userRole || "none"} is not allowed. Required: ${roles.join(", ")}`,
			);
		}
	};
};

/**
 * Higher-order wrapper for API route handlers that enforces authorization
 * before invoking the handler.
 * @param {Function} handler - The route handler to wrap
 * @param {{
 *   action: string,
 *   resource: string,
 *   getContext?: (req: unknown, session: { user: AuthUser }) => Record<string, unknown> | Promise<Record<string, unknown>>
 * }} options - Authorization options
 * @returns {Function} Wrapped handler
 */
export const withAuthorization = (
	handler,
	{ action, resource, getContext },
) => {
	return async (req, session) => {
		const user = session?.user;
		if (!user) {
			throw new ForbiddenError("No user in session");
		}

		const context = getContext ? await getContext(req, session) : undefined;
		authorization.authorize(user, action, resource, context);

		return handler(req, session);
	};
};
