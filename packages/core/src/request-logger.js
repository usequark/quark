/**
 * Request/Response Logging Middleware
 *
 * Logs HTTP request and response details for debugging and auditing.
 * Sanitizes sensitive data (passwords, tokens) from request bodies.
 * Logs response bodies only for errors (4xx/5xx status codes).
 */

import { logger } from "./logger.js";

/**
 * Fields to sanitize from request bodies (replace with "[REDACTED]")
 */
const SENSITIVE_FIELDS = [
	"password",
	"token",
	"secret",
	"apiKey",
	"api_key",
	"authorization",
	"passwordConfirmation",
	"oldPassword",
	"newPassword",
	"currentPassword",
];

/**
 * Recursively sanitize sensitive fields in an object
 * @param {any} obj - Object to sanitize
 * @param {string[]} fields - List of sensitive field names
 * @returns {any} Sanitized object
 */
function sanitizeObject(obj, fields = SENSITIVE_FIELDS) {
	if (!obj || typeof obj !== "object") {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => sanitizeObject(item, fields));
	}

	const sanitized = {};
	for (const [key, value] of Object.entries(obj)) {
		const keyLower = key.toLowerCase();
		if (fields.some((field) => keyLower.includes(field.toLowerCase()))) {
			sanitized[key] = "[REDACTED]";
		} else if (typeof value === "object" && value !== null) {
			sanitized[key] = sanitizeObject(value, fields);
		} else {
			sanitized[key] = value;
		}
	}
	return sanitized;
}

/**
 * Create request logger options
 * @typedef {Object} RequestLoggerOptions
 * @property {boolean} [logRequestBody=true] - Log request body
 * @property {boolean} [logResponseBody=false] - Log response body for all requests
 * @property {boolean} [logErrorResponseBody=true] - Log response body only for errors
 * @property {string[]} [sensitiveFields] - Custom sensitive field names to sanitize
 * @property {number} [maxBodyLength=1000] - Max characters to log from body (prevents massive logs)
 */

/**
 * Create a request logger middleware for Next.js API routes
 *
 * @param {RequestLoggerOptions} [options={}] - Logging options
 * @returns {Function} Middleware function
 *
 * @example
 * import { createRequestLogger } from "@techstream/quark-core";
 *
 * const logRequest = createRequestLogger({
 *   logRequestBody: true,
 *   logErrorResponseBody: true,
 * });
 *
 * export async function GET(request) {
 *   return logRequest(request, async () => {
 *     // Your handler logic
 *     return NextResponse.json({ data: "..." });
 *   });
 * }
 */
export function createRequestLogger(options = {}) {
	const {
		logRequestBody = true,
		logResponseBody = false,
		logErrorResponseBody = true,
		sensitiveFields = SENSITIVE_FIELDS,
		maxBodyLength = 1000,
	} = options;

	return async (request, handler) => {
		const startTime = Date.now();
		const { method, url } = request;
		const { pathname, searchParams } = new URL(url);

		// Build log context
		const logContext = {
			method,
			path: pathname,
			query: Object.fromEntries(searchParams),
			headers: {
				"user-agent": request.headers.get("user-agent"),
				"content-type": request.headers.get("content-type"),
			},
		};

		// Log request body for non-GET requests
		if (logRequestBody && method !== "GET" && method !== "HEAD") {
			try {
				// Clone request to read body without consuming it
				const clonedRequest = request.clone();
				const contentType = request.headers.get("content-type") || "";

				if (contentType.includes("application/json")) {
					const body = await clonedRequest.json();
					const sanitized = sanitizeObject(body, sensitiveFields);
					const bodyStr = JSON.stringify(sanitized);
					logContext.body =
						bodyStr.length > maxBodyLength
							? `${bodyStr.substring(0, maxBodyLength)}... [truncated]`
							: bodyStr;
				} else if (contentType.includes("application/x-www-form-urlencoded")) {
					const text = await clonedRequest.text();
					const params = new URLSearchParams(text);
					const paramsObj = Object.fromEntries(params);
					const sanitized = sanitizeObject(paramsObj, sensitiveFields);
					logContext.body = sanitized;
				} else {
					logContext.body = `[${contentType || "unknown content-type"}]`;
				}
			} catch (error) {
				logContext.bodyError = error.message;
			}
		}

		logger.info("Incoming request", logContext);

		let response;
		let responseError = null;

		try {
			// Execute the handler
			response = await handler(request);
		} catch (error) {
			responseError = error;
			throw error; // Re-throw to maintain error flow
		} finally {
			const duration = Date.now() - startTime;

			const responseLog = {
				method,
				path: pathname,
				duration: `${duration}ms`,
			};

			if (response) {
				responseLog.status = response.status;

				// Log response body for errors or if explicitly enabled
				const isError = response.status >= 400;
				const shouldLogBody =
					logResponseBody || (logErrorResponseBody && isError);

				if (shouldLogBody) {
					try {
						const clonedResponse = response.clone();
						const contentType = response.headers.get("content-type") || "";

						if (contentType.includes("application/json")) {
							const body = await clonedResponse.json();
							const bodyStr = JSON.stringify(body);
							responseLog.body =
								bodyStr.length > maxBodyLength
									? `${bodyStr.substring(0, maxBodyLength)}... [truncated]`
									: bodyStr;
						}
					} catch (error) {
						responseLog.bodyError = error.message;
					}
				}

				if (isError) {
					logger.error("Request completed with error", responseLog);
				} else {
					logger.info("Request completed", responseLog);
				}
			} else if (responseError) {
				responseLog.error = responseError.message;
				responseLog.stack = responseError.stack;
				logger.error("Request failed", responseLog);
			}
		}

		return response;
	};
}

/**
 * Default request logger instance
 */
export const logRequest = createRequestLogger();

/**
 * Export sanitization utility for standalone use
 */
export { sanitizeObject };
