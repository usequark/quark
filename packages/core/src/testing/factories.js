/**
 * Test data factories for creating realistic test objects with sensible defaults.
 *
 * Usage:
 *   import { createTestUser, createTestPost, createTestSession } from "@bobnoddle/quark-core/testing";
 *   const user = createTestUser({ name: "Custom Name" });
 *   const post = createTestPost({ authorId: user.id, published: true });
 *   const session = createTestSession({ user: { role: "admin" } });
 *
 * @module testing/factories
 */

/**
 * Generate a short random ID string.
 * @returns {string}
 */
function randomId() {
	return Math.random().toString(36).slice(2, 10);
}

/**
 * Create a test User object matching the Prisma User model shape.
 * All fields have sensible defaults that can be overridden.
 *
 * @param {Object} [overrides={}]
 * @returns {Object}
 *
 * @example
 * const user = createTestUser({ role: "admin" });
 */
export function createTestUser(overrides = {}) {
	return {
		id: overrides.id || `user_${randomId()}`,
		email: overrides.email || `test-${randomId()}@example.com`,
		name: overrides.name || "Test User",
		role: overrides.role || "viewer",
		password: overrides.password || null,
		image: overrides.image || null,
		emailVerified: overrides.emailVerified || null,
		createdAt: overrides.createdAt || new Date(),
		updatedAt: overrides.updatedAt || new Date(),
		...overrides,
	};
}

/**
 * Create a test Post object matching the Prisma Post model shape.
 *
 * @param {Object} [overrides={}]
 * @returns {Object}
 *
 * @example
 * const post = createTestPost({ title: "My Post", published: true });
 */
export function createTestPost(overrides = {}) {
	return {
		id: overrides.id || `post_${randomId()}`,
		title: overrides.title || "Test Post",
		content: overrides.content || "Test content",
		published: overrides.published ?? false,
		authorId: overrides.authorId || `user_${randomId()}`,
		createdAt: overrides.createdAt || new Date(),
		updatedAt: overrides.updatedAt || new Date(),
		...overrides,
	};
}

/**
 * Create a test session object compatible with NextAuth session shape.
 * Optionally pass user overrides to customize the embedded user.
 *
 * @param {Object} [overrides={}]
 * @returns {Object}
 *
 * @example
 * const session = createTestSession({ user: { role: "admin" } });
 */
export function createTestSession(overrides = {}) {
	const user = createTestUser(overrides.user);
	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			...overrides.user,
		},
		expires:
			overrides.expires ||
			new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		...overrides,
	};
}
