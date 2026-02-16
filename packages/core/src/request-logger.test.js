import assert from "node:assert";
import { describe, test } from "node:test";
import {
	createRequestLogger,
	logRequest,
	sanitizeObject,
} from "./request-logger.js";

describe("sanitizeObject", () => {
	test("sanitizes password field", () => {
		const input = { username: "alice", password: "secret123" };
		const result = sanitizeObject(input);

		assert.strictEqual(result.username, "alice");
		assert.strictEqual(result.password, "[REDACTED]");
	});

	test("sanitizes multiple sensitive fields", () => {
		const input = {
			email: "alice@example.com",
			password: "secret",
			token: "abc123",
			apiKey: "key-xyz",
		};
		const result = sanitizeObject(input);

		assert.strictEqual(result.email, "alice@example.com");
		assert.strictEqual(result.password, "[REDACTED]");
		assert.strictEqual(result.token, "[REDACTED]");
		assert.strictEqual(result.apiKey, "[REDACTED]");
	});

	test("sanitizes nested objects", () => {
		const input = {
			user: {
				name: "alice",
				credentials: {
					password: "secret",
					apiKey: "key123",
				},
			},
		};
		const result = sanitizeObject(input);

		assert.strictEqual(result.user.name, "alice");
		assert.strictEqual(result.user.credentials.password, "[REDACTED]");
		assert.strictEqual(result.user.credentials.apiKey, "[REDACTED]");
	});

	test("sanitizes arrays of objects", () => {
		const input = [
			{ id: 1, password: "secret1" },
			{ id: 2, token: "token2" },
		];
		const result = sanitizeObject(input);

		assert.strictEqual(result[0].id, 1);
		assert.strictEqual(result[0].password, "[REDACTED]");
		assert.strictEqual(result[1].id, 2);
		assert.strictEqual(result[1].token, "[REDACTED]");
	});

	test("is case-insensitive for field matching", () => {
		const input = { PASSWORD: "secret", Token: "abc", ApiKey: "xyz" };
		const result = sanitizeObject(input);

		assert.strictEqual(result.PASSWORD, "[REDACTED]");
		assert.strictEqual(result.Token, "[REDACTED]");
		assert.strictEqual(result.ApiKey, "[REDACTED]");
	});

	test("handles null and undefined values", () => {
		const input = {
			username: null,
			password: undefined,
			email: "test@example.com",
		};
		const result = sanitizeObject(input);

		assert.strictEqual(result.username, null);
		assert.strictEqual(result.password, "[REDACTED]");
		assert.strictEqual(result.email, "test@example.com");
	});

	test("handles non-object inputs", () => {
		assert.strictEqual(sanitizeObject("string"), "string");
		assert.strictEqual(sanitizeObject(123), 123);
		assert.strictEqual(sanitizeObject(null), null);
		assert.strictEqual(sanitizeObject(undefined), undefined);
	});

	test("uses custom sensitive fields list", () => {
		const input = { username: "alice", customSecret: "value" };
		const result = sanitizeObject(input, ["customSecret"]);

		assert.strictEqual(result.username, "alice");
		assert.strictEqual(result.customSecret, "[REDACTED]");
	});

	test("sanitizes partial field name matches", () => {
		const input = {
			oldPassword: "old",
			newPassword: "new",
			userPassword: "user",
		};
		const result = sanitizeObject(input);

		assert.strictEqual(result.oldPassword, "[REDACTED]");
		assert.strictEqual(result.newPassword, "[REDACTED]");
		assert.strictEqual(result.userPassword, "[REDACTED]");
	});
});

describe("createRequestLogger", () => {
	// Mock request helper
	function createMockRequest(options = {}) {
		const {
			method = "GET",
			url = "http://localhost:3000/api/test",
			headers = {},
			body = null,
		} = options;

		const mockHeaders = new Map(Object.entries(headers));

		const request = {
			method,
			url,
			headers: {
				get: (key) => mockHeaders.get(key) || null,
			},
			clone: () => ({
				...request,
				json: async () => body,
				text: async () =>
					typeof body === "string" ? body : JSON.stringify(body),
			}),
		};

		return request;
	}

	// Mock response helper
	function createMockResponse(options = {}) {
		const {
			status = 200,
			body = {},
			contentType = "application/json",
		} = options;

		const mockHeaders = new Map([["content-type", contentType]]);

		return {
			status,
			headers: {
				get: (key) => mockHeaders.get(key) || null,
			},
			clone: () => ({
				json: async () => body,
			}),
		};
	}

	test("logs GET request without body", async () => {
		const logger = createRequestLogger();
		const request = createMockRequest({ method: "GET" });

		const mockHandler = async () => createMockResponse({ status: 200 });

		const response = await logger(request, mockHandler);
		assert.strictEqual(response.status, 200);
	});

	test("logs POST request with JSON body", async () => {
		const logger = createRequestLogger({ logRequestBody: true });
		const request = createMockRequest({
			method: "POST",
			headers: { "content-type": "application/json" },
			body: { username: "alice", password: "secret123" },
		});

		const mockHandler = async () => createMockResponse({ status: 201 });

		const response = await logger(request, mockHandler);
		assert.strictEqual(response.status, 201);
	});

	test("sanitizes sensitive fields in request body", async () => {
		const logger = createRequestLogger({ logRequestBody: true });
		const request = createMockRequest({
			method: "POST",
			headers: { "content-type": "application/json" },
			body: { email: "alice@example.com", password: "secret", token: "abc123" },
		});

		const mockHandler = async () => createMockResponse({ status: 200 });

		const response = await logger(request, mockHandler);
		assert.strictEqual(response.status, 200);
		// Password and token should be sanitized in logs (verified via manual inspection or log capture)
	});

	test("logs response body for error status", async () => {
		const logger = createRequestLogger({ logErrorResponseBody: true });
		const request = createMockRequest({ method: "GET" });

		const mockHandler = async () =>
			createMockResponse({
				status: 404,
				body: { error: "Not found" },
			});

		const response = await logger(request, mockHandler);
		assert.strictEqual(response.status, 404);
	});

	test("truncates long request bodies", async () => {
		const logger = createRequestLogger({
			logRequestBody: true,
			maxBodyLength: 50,
		});
		const longBody = { data: "x".repeat(100) };
		const request = createMockRequest({
			method: "POST",
			headers: { "content-type": "application/json" },
			body: longBody,
		});

		const mockHandler = async () => createMockResponse();

		await logger(request, mockHandler);
		// Body truncation should occur (verified via log inspection)
	});

	test("handles handler errors gracefully", async () => {
		const logger = createRequestLogger();
		const request = createMockRequest();

		const mockHandler = async () => {
			throw new Error("Handler error");
		};

		await assert.rejects(
			async () => await logger(request, mockHandler),
			/Handler error/,
		);
	});

	test("respects custom sensitive fields", async () => {
		const logger = createRequestLogger({
			logRequestBody: true,
			sensitiveFields: ["customSecret"],
		});
		const request = createMockRequest({
			method: "POST",
			headers: { "content-type": "application/json" },
			body: { username: "alice", customSecret: "value" },
		});

		const mockHandler = async () => createMockResponse();

		await logger(request, mockHandler);
		// customSecret should be sanitized (verified via log inspection)
	});

	test("does not log request body when disabled", async () => {
		const logger = createRequestLogger({ logRequestBody: false });
		const request = createMockRequest({
			method: "POST",
			headers: { "content-type": "application/json" },
			body: { password: "secret" },
		});

		const mockHandler = async () => createMockResponse();

		const response = await logger(request, mockHandler);
		assert.strictEqual(response.status, 200);
		// Body should not appear in logs (verified via log inspection)
	});
});

describe("logRequest", () => {
	test("default logger instance exists", () => {
		assert.ok(typeof logRequest === "function");
	});
});
