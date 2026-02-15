/**
 * Quark test utilities — zero-dependency helpers for testing Quark applications.
 *
 * Import from `@techstream/quark-core/testing` in your test files:
 *
 * ```js
 * import {
 *   createTestUser,
 *   createTestPost,
 *   createTestSession,
 *   createMockPrisma,
 *   createMockRequest,
 *   createMockResponse,
 *   createMockRedis,
 *   captureConsole,
 *   waitFor,
 *   createTestContext,
 *   assertThrows,
 *   assertApiResponse,
 * } from "@techstream/quark-core/testing";
 * ```
 *
 * @module testing
 */

// Factories — test data creation
export {
	createTestPost,
	createTestSession,
	createTestUser,
} from "./factories.js";
// Helpers — test utilities
export {
	assertApiResponse,
	assertThrows,
	captureConsole,
	createTestContext,
	waitFor,
} from "./helpers.js";
// Mocks — service stand-ins
export {
	createMockPrisma,
	createMockRedis,
	createMockRequest,
	createMockResponse,
} from "./mocks.js";
