/**
 * Mobile equivalent of @techstream/quark-core's AppError.
 *
 * React Native cannot import Node.js packages, so this module defines a
 * client-side error class whose shape mirrors AppError.toJSON() — same
 * fields (code, statusCode, details) — so the web API's error responses
 * are consumed identically. Keep the two in sync if adding new fields.
 */
export interface AppClientError {
	name: string;
	message: string;
	code: string;
	statusCode: number;
	timestamp?: string;
	details?: unknown;
	retryAfter?: number;
}

export class ApiError extends Error {
	code: string;
	statusCode: number;
	details?: unknown;

	constructor(error: AppClientError) {
		super(error.message);
		this.name = error.name;
		this.code = error.code;
		this.statusCode = error.statusCode;
		this.details = error.details;
	}
}

/**
 * Pattern-match on error codes for conditional handling.
 */
export function isValidationError(error: unknown): error is ApiError {
	return error instanceof ApiError && error.code === "VALIDATION_ERROR";
}

export function isUnauthorizedError(error: unknown): error is ApiError {
	return error instanceof ApiError && error.code === "UNAUTHORIZED";
}

export function isRateLimitError(error: unknown): error is ApiError {
	return error instanceof ApiError && error.code === "RATE_LIMIT";
}
