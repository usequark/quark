/**
 * @quark/core - Error Handling Module
 * Standardized error types and utilities for consistent error handling
 */

/**
 * Base application error class
 */
export class AppError extends Error {
	constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
		super(message);
		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.code = code;
		this.timestamp = new Date().toISOString();
		Error.captureStackTrace(this, this.constructor);
	}

	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			statusCode: this.statusCode,
			timestamp: this.timestamp,
		};
	}
}

/**
 * 400 Bad Request Error
 */
export class ValidationError extends AppError {
	constructor(message, details = null) {
		super(message, 400, "VALIDATION_ERROR");
		this.details = details;
	}

	toJSON() {
		return {
			...super.toJSON(),
			details: this.details,
		};
	}
}

/**
 * 401 Unauthorized Error
 */
export class UnauthorizedError extends AppError {
	constructor(message = "Authentication required") {
		super(message, 401, "UNAUTHORIZED");
	}
}

/**
 * 403 Forbidden Error
 */
export class ForbiddenError extends AppError {
	constructor(message = "Access denied") {
		super(message, 403, "FORBIDDEN");
	}
}

/**
 * 404 Not Found Error
 */
export class NotFoundError extends AppError {
	constructor(message = "Resource not found") {
		super(message, 404, "NOT_FOUND");
	}
}

/**
 * 409 Conflict Error
 */
export class ConflictError extends AppError {
	constructor(message = "Resource conflict") {
		super(message, 409, "CONFLICT");
	}
}

/**
 * 429 Rate Limit Error
 */
export class RateLimitError extends AppError {
	constructor(message = "Too many requests", retryAfter = 60) {
		super(message, 429, "RATE_LIMIT");
		this.retryAfter = retryAfter;
	}

	toJSON() {
		return {
			...super.toJSON(),
			retryAfter: this.retryAfter,
		};
	}
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
	constructor(message = "Database error", originalError = null) {
		super(message, 500, "DATABASE_ERROR");
		this.originalError = originalError;
	}
}

/**
 * External Service Error
 */
export class ServiceError extends AppError {
	constructor(serviceName, message = "Service error", statusCode = 502) {
		super(message, statusCode, "SERVICE_ERROR");
		this.serviceName = serviceName;
	}

	toJSON() {
		return {
			...super.toJSON(),
			serviceName: this.serviceName,
		};
	}
}

/**
 * Safely extracts error message from various error types
 * @param {Error|string|Object} error - The error to extract from
 * @returns {string} Extracted error message
 */
export const getErrorMessage = (error) => {
	if (typeof error === "string") return error;
	if (error instanceof Error) return error.message;
	if (error && typeof error === "object" && error.message) return error.message;
	return "An unknown error occurred";
};

/**
 * Safely extracts status code from error
 * @param {Error|AppError} error - The error to extract from
 * @returns {number} HTTP status code
 */
export const getStatusCode = (error) => {
	if (error instanceof AppError) return error.statusCode;
	if (error.statusCode) return error.statusCode;
	return 500;
};

/**
 * Converts any error to an AppError instance
 * @param {Error|AppError|any} error - The error to normalize
 * @returns {AppError} Normalized error
 */
export const normalizeError = (error) => {
	if (error instanceof AppError) return error;
	if (error instanceof Error) {
		return new AppError(error.message, 500, "INTERNAL_ERROR");
	}
	return new AppError(
		typeof error === "string" ? error : "An unknown error occurred",
		500,
		"INTERNAL_ERROR"
	);
};

/**
 * Logs error with context
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context
 */
export const logError = (error, context = {}) => {
	const appError = normalizeError(error);
	console.error({
		timestamp: new Date().toISOString(),
		error: appError.toJSON(),
		context,
		stack: error.stack,
	});
};

/**
 * Wraps async function and handles errors consistently
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
export const withErrorHandling = (fn) => {
	return async (...args) => {
		try {
			return await fn(...args);
		} catch (error) {
			logError(error);
			throw normalizeError(error);
		}
	};
};
