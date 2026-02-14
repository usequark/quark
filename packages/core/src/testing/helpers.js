/**
 * Test helper utilities for common testing patterns.
 *
 * @module testing/helpers
 */

import assert from "node:assert/strict";

/**
 * @typedef {Object} CapturedOutput
 * @property {Array<{method: string, args: Array<*>}>} output - Captured console entries
 * @property {() => void} restore - Restore original console methods
 */

/**
 * Capture console output during test execution.
 * Intercepts console.log, .warn, .error, .info, and .debug.
 * Call `.restore()` when done to put the original methods back.
 *
 * @returns {CapturedOutput}
 *
 * @example
 * const { output, restore } = captureConsole();
 * console.log("hello");
 * console.error("oops");
 * restore();
 * // output => [{ method: "log", args: ["hello"] }, { method: "error", args: ["oops"] }]
 */
export function captureConsole() {
	/** @type {Array<{method: string, args: Array<*>}>} */
	const output = [];

	const original = {
		log: console.log,
		warn: console.warn,
		error: console.error,
		info: console.info,
		debug: console.debug,
	};

	for (const method of /** @type {const} */ ([
		"log",
		"warn",
		"error",
		"info",
		"debug",
	])) {
		console[method] = (...args) => {
			output.push({ method, args });
		};
	}

	function restore() {
		for (const [method, fn] of Object.entries(original)) {
			console[method] = fn;
		}
	}

	return { output, restore };
}

/**
 * Wait for an async assertion to pass, retrying at a regular interval until timeout.
 * Useful for testing eventually-consistent behavior or polling.
 *
 * @param {() => void | Promise<void>} fn - Assertion function that throws on failure
 * @param {Object} [options]
 * @param {number} [options.timeout=5000] - Maximum time to wait in milliseconds
 * @param {number} [options.interval=50] - Time between retries in milliseconds
 * @returns {Promise<void>}
 * @throws {Error} The last error thrown by `fn` if timeout is reached
 *
 * @example
 * await waitFor(() => {
 *   assert.strictEqual(getStatus(), "ready");
 * }, { timeout: 2000 });
 */
export async function waitFor(fn, { timeout = 5000, interval = 50 } = {}) {
	const start = Date.now();
	let lastError;

	while (Date.now() - start < timeout) {
		try {
			await fn();
			return;
		} catch (err) {
			lastError = err;
			await new Promise((resolve) => setTimeout(resolve, interval));
		}
	}

	throw lastError;
}

/**
 * @typedef {Object} TestContext
 * @property {(key: string, value: string | undefined) => void} setEnv - Set an environment variable (original is saved for restore)
 * @property {() => void} restoreEnv - Restore all modified environment variables to their original values
 * @property {(fn: () => void | Promise<void>) => void} onCleanup - Register a cleanup function
 * @property {() => Promise<void>} cleanup - Run all registered cleanup functions and restore env
 */

/**
 * Create a temporary test context that tracks environment variable changes
 * and cleanup functions. Call `.cleanup()` at the end of your test to restore everything.
 *
 * @returns {TestContext}
 *
 * @example
 * const ctx = createTestContext();
 * ctx.setEnv("NODE_ENV", "test");
 * ctx.setEnv("API_KEY", "secret");
 * // ... run your test ...
 * await ctx.cleanup(); // restores NODE_ENV and API_KEY to original values
 */
export function createTestContext() {
	/** @type {Map<string, string | undefined>} */
	const savedEnv = new Map();
	/** @type {Array<() => void | Promise<void>>} */
	const cleanupFns = [];

	return {
		/**
		 * Set an environment variable. The original value is saved for later restore.
		 * @param {string} key
		 * @param {string | undefined} value - Pass `undefined` to delete the variable
		 */
		setEnv(key, value) {
			if (!savedEnv.has(key)) {
				savedEnv.set(key, process.env[key]);
			}
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		},

		/** Restore all modified environment variables to their original values. */
		restoreEnv() {
			for (const [key, value] of savedEnv) {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			}
			savedEnv.clear();
		},

		/**
		 * Register a cleanup function to be called during `.cleanup()`.
		 * @param {() => void | Promise<void>} fn
		 */
		onCleanup(fn) {
			cleanupFns.push(fn);
		},

		/** Run all registered cleanup functions (LIFO) and restore environment variables. */
		async cleanup() {
			// Run cleanups in reverse order (LIFO)
			for (let i = cleanupFns.length - 1; i >= 0; i--) {
				await cleanupFns[i]();
			}
			cleanupFns.length = 0;

			// Restore env
			for (const [key, value] of savedEnv) {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			}
			savedEnv.clear();
		},
	};
}

/**
 * Assert that an async function throws an error matching the given class and/or message pattern.
 *
 * @param {() => Promise<*>} fn - Async function expected to throw
 * @param {Function} [ErrorClass] - Expected error constructor (e.g. `TypeError`, `AppError`)
 * @param {string | RegExp} [messagePattern] - String or regex to match against the error message
 * @returns {Promise<Error>} The caught error (for further assertions)
 * @throws {import("node:assert").AssertionError} If `fn` does not throw, or the error doesn't match
 *
 * @example
 * await assertThrows(
 *   () => someAsyncFunction(),
 *   ValidationError,
 *   /invalid email/i,
 * );
 */
export async function assertThrows(fn, ErrorClass, messagePattern) {
	let threw = false;
	let caughtError;

	try {
		await fn();
	} catch (err) {
		threw = true;
		caughtError = err;
	}

	assert.ok(threw, "Expected function to throw, but it did not");

	if (ErrorClass) {
		assert.ok(
			caughtError instanceof ErrorClass,
			`Expected error to be instance of ${ErrorClass.name}, got ${caughtError?.constructor?.name}: ${caughtError?.message}`,
		);
	}

	if (messagePattern) {
		const message = caughtError?.message || "";
		if (typeof messagePattern === "string") {
			assert.ok(
				message.includes(messagePattern),
				`Expected error message to include "${messagePattern}", got "${message}"`,
			);
		} else {
			assert.match(message, messagePattern);
		}
	}

	return caughtError;
}

/**
 * Assert that a response object has the expected status code and body content.
 * Works with mock responses and real fetch Response objects.
 *
 * @param {Object} response - Response object with `status` property
 * @param {Object} expected
 * @param {number} [expected.status] - Expected HTTP status code
 * @param {Record<string, *>} [expected.bodyIncludes] - Keys/values expected in the response body
 * @returns {void}
 *
 * @example
 * const res = await handler(req);
 * assertApiResponse(res, {
 *   status: 200,
 *   bodyIncludes: { success: true },
 * });
 */
export function assertApiResponse(response, { status, bodyIncludes } = {}) {
	if (status !== undefined) {
		assert.strictEqual(
			response.status,
			status,
			`Expected status ${status}, got ${response.status}`,
		);
	}

	if (bodyIncludes && response.body) {
		for (const [key, value] of Object.entries(bodyIncludes)) {
			assert.deepStrictEqual(
				response.body[key],
				value,
				`Expected response.body.${key} to equal ${JSON.stringify(value)}`,
			);
		}
	}
}
