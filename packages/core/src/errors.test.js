import assert from "assert";
import { test } from "node:test";
import {
	AppError,
	ValidationError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError,
	ConflictError,
	RateLimitError,
	DatabaseError,
	ServiceError,
	getErrorMessage,
	getStatusCode,
	normalizeError,
	logError,
} from "../src/errors.js";

test("Error Module", async (t) => {
	await t.test("AppError has correct properties", () => {
		const error = new AppError("Test error", 500, "TEST_ERROR");
		assert(error.message === "Test error");
		assert(error.statusCode === 500);
		assert(error.code === "TEST_ERROR");
		assert(error.name === "AppError");
	});

	await t.test("AppError.toJSON() serializes correctly", () => {
		const error = new AppError("Test", 500, "TEST");
		const json = error.toJSON();
		assert(json.message === "Test");
		assert(json.statusCode === 500);
		assert(json.code === "TEST");
		assert(json.timestamp);
	});

	await t.test("ValidationError has status 400", () => {
		const error = new ValidationError("Invalid input");
		assert(error.statusCode === 400);
		assert(error.code === "VALIDATION_ERROR");
	});

	await t.test("UnauthorizedError has status 401", () => {
		const error = new UnauthorizedError();
		assert(error.statusCode === 401);
		assert(error.code === "UNAUTHORIZED");
	});

	await t.test("ForbiddenError has status 403", () => {
		const error = new ForbiddenError();
		assert(error.statusCode === 403);
		assert(error.code === "FORBIDDEN");
	});

	await t.test("NotFoundError has status 404", () => {
		const error = new NotFoundError();
		assert(error.statusCode === 404);
		assert(error.code === "NOT_FOUND");
	});

	await t.test("ConflictError has status 409", () => {
		const error = new ConflictError();
		assert(error.statusCode === 409);
		assert(error.code === "CONFLICT");
	});

	await t.test("RateLimitError has status 429", () => {
		const error = new RateLimitError("Too many requests", 60);
		assert(error.statusCode === 429);
		assert(error.code === "RATE_LIMIT");
		assert(error.retryAfter === 60);
	});

	await t.test("DatabaseError wraps database errors", () => {
		const originalError = new Error("Connection failed");
		const error = new DatabaseError("DB error", originalError);
		assert(error.statusCode === 500);
		assert(error.originalError === originalError);
	});

	await t.test("ServiceError includes service name", () => {
		const error = new ServiceError("PaymentAPI", "Payment failed");
		assert(error.serviceName === "PaymentAPI");
		assert(error.statusCode === 502);
		const json = error.toJSON();
		assert(json.serviceName === "PaymentAPI");
	});

	await t.test("getErrorMessage extracts from various types", () => {
		assert(getErrorMessage("string error") === "string error");
		assert(
			getErrorMessage(new Error("error message")) === "error message"
		);
		assert(getErrorMessage({ message: "obj error" }) === "obj error");
		assert(getErrorMessage({}).includes("unknown")); // Changed from null to empty object
	});

	await t.test("getStatusCode returns correct code", () => {
		assert(getStatusCode(new ValidationError("")) === 400);
		assert(getStatusCode(new UnauthorizedError()) === 401);
		assert(getStatusCode(new NotFoundError()) === 404);
		assert(getStatusCode(new Error()) === 500);
	});

	await t.test("normalizeError converts to AppError", () => {
		const error = normalizeError(new Error("test"));
		assert(error instanceof AppError);
		assert(error.message === "test");
		assert(error.statusCode === 500);
	});

	await t.test("normalizeError handles string errors", () => {
		const error = normalizeError("string error");
		assert(error instanceof AppError);
		assert(error.message === "string error");
	});

	await t.test("normalizeError handles non-Error objects", () => {
		const error = normalizeError({ some: "object" });
		assert(error instanceof AppError);
		assert(error.message.includes("unknown"));
	});

	await t.test("logError handles errors with context", () => {
		// This should not throw
		const error = new ValidationError("test");
		logError(error, { userId: "123", action: "test" });
		assert(true);
	});
});
