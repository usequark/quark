import crypto from "node:crypto";

/**
 * @usequark/quark-core - Utility Functions
 * Common utility functions used across the platform
 */

/**
 * Retries an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.onRetry - Callback on each retry
 * @returns {Promise<any>} Result of the function
 */
export const retryAsync = async (fn, options = {}) => {
	const {
		maxAttempts = 3,
		initialDelay = 1000,
		maxDelay = 10000,
		onRetry = null,
	} = options;

	let lastError;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (attempt < maxAttempts) {
				const delay = Math.min(initialDelay * 2 ** (attempt - 1), maxDelay);
				if (onRetry) {
					onRetry({ attempt, delay, error });
				}
				await sleep(delay);
			}
		}
	}

	throw lastError;
};

/**
 * Sleeps for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = (ms) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Validates required environment variables
 * @param {Array<string>} vars - Variable names to validate
 * @throws {Error} If any variables are missing
 * @returns {boolean} True if all variables exist
 */
export const validateEnv = (vars) => {
	const missing = vars.filter((v) => !process.env[v]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}

	return true;
};

/**
 * Deep merges two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge
 * @returns {Object} Merged object
 */
export const deepMerge = (target, source) => {
	const output = Object.assign({}, target);

	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach((key) => {
			// Guard against prototype pollution
			if (key === "__proto__" || key === "constructor" || key === "prototype") {
				return;
			}
			if (isObject(source[key])) {
				if (!(key in target)) {
					Object.assign(output, { [key]: source[key] });
				} else {
					output[key] = deepMerge(target[key], source[key]);
				}
			} else {
				Object.assign(output, { [key]: source[key] });
			}
		});
	}

	return output;
};

/**
 * Checks if value is a plain object
 * @param {any} item - Item to check
 * @returns {boolean}
 */
export const isObject = (item) => {
	return item && typeof item === "object" && !Array.isArray(item);
};

/**
 * @deprecated Use `getErrorMessage` from `@usequark/quark-core/errors` instead.
 * Normalizes error messages for consistency
 * @param {Error|string} error - Error to normalize
 * @returns {string} Normalized error message
 */
export { getErrorMessage as normalizeErrorMessage } from "./errors.js";

/**
 * Generates a cryptographically secure random string of specified length.
 * Uses crypto.randomBytes for secure randomness - safe for tokens and IDs.
 * @param {number} length - String length
 * @param {string} chars - Characters to use (default: alphanumeric)
 * @returns {string} Random string
 */
export const randomString = (
	length = 16,
	chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
) => {
	const bytes = crypto.randomBytes(length);
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(bytes[i] % chars.length);
	}
	return result;
};

/**
 * Sanitizes a string for use in URLs or IDs
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeId = (str) => {
	return str
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
};

/**
 * Formats bytes to human-readable size
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size
 */
export const formatBytes = (bytes) => {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
};

/**
 * Measures execution time of async function
 * @param {Function} fn - Async function to measure
 * @returns {Promise<Object>} { result, duration: ms }
 */
export const measureTime = async (fn) => {
	const start = performance.now();
	const result = await fn();
	const duration = performance.now() - start;

	return { result, duration: Math.round(duration * 100) / 100 };
};

/**
 * Creates a debounced function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (fn, delay = 300) => {
	let timeoutId;

	return (...args) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
};

/**
 * Creates a memoized function (caches results)
 * @param {Function} fn - Function to memoize
 * @param {number} ttl - Time to live in milliseconds (0 = no expiry)
 * @returns {Function} Memoized function
 */
export const memoize = (fn, ttl = 0) => {
	const cache = new Map();

	return (...args) => {
		const key = JSON.stringify(args);

		if (cache.has(key)) {
			const cached = cache.get(key);
			if (ttl === 0 || Date.now() - cached.timestamp < ttl) {
				return cached.value;
			}
			cache.delete(key);
		}

		const value = fn(...args);
		cache.set(key, { value, timestamp: Date.now() });
		return value;
	};
};

/** Placeholder written over a credential segment. No brackets — the URL
 * serializer would percent-encode them into `%5BREDACTED%5D`. */
const REDACTED_CREDENTIAL = "REDACTED";

/**
 * Strips credentials from a URL so it is safe to log or return from an
 * unauthenticated endpoint.
 *
 * Connection strings reach places the process cannot control: `/api/health`
 * has no auth and echoes the message from a failed probe, and startup logs end
 * up in a log aggregator. `redis://default:hunter2@cache.internal:6379` in any
 * of those is a credential disclosure, so nothing that embeds a URL in a
 * message should skip this.
 *
 * Parseable URLs are rewritten field by field. Anything else is run through a
 * regex that strips the userinfo segment of a URL-shaped string. A string that
 * matches neither has no recognisable credential segment and is returned
 * unchanged.
 *
 * @param {string} url
 * @returns {string} The URL with any username/password replaced
 */
export const redactUrl = (url) => {
	if (typeof url !== "string" || url.length === 0) return url;

	try {
		const parsed = new URL(url);

		if (!parsed.username && !parsed.password) return url;

		parsed.username = parsed.username ? REDACTED_CREDENTIAL : "";
		parsed.password = parsed.password ? REDACTED_CREDENTIAL : "";
		return parsed.toString();
	} catch {
		return url.replace(
			/^([a-z][a-z0-9+.-]*:\/\/)[^/?#@]*@/i,
			`$1${REDACTED_CREDENTIAL}@`,
		);
	}
};
