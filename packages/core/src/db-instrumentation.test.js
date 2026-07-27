import assert from "node:assert";
import { test, mock } from "node:test";

// Module-level env control: restore after each test.
const ORIGINAL_ENV = { ...process.env };

test("db-instrumentation", async (t) => {
	t.afterEach(() => {
		process.env.DB_INSTRUMENTATION = ORIGINAL_ENV.DB_INSTRUMENTATION;
		process.env.DB_SLOW_QUERY_THRESHOLD = ORIGINAL_ENV.DB_SLOW_QUERY_THRESHOLD;
	});

	await t.test("exports createDbInstrumentation", async () => {
		const mod = await import("./db-instrumentation.js");
		assert.equal(typeof mod.createDbInstrumentation, "function");
	});

	await t.test("exports maskSensitiveValues", async () => {
		const mod = await import("./db-instrumentation.js");
		assert.equal(typeof mod.maskSensitiveValues, "function");
	});

	await t.test("exports isSensitiveKey", async () => {
		const mod = await import("./db-instrumentation.js");
		assert.equal(typeof mod.isSensitiveKey, "function");
	});

	await t.test("exports summarizeArgs", async () => {
		const mod = await import("./db-instrumentation.js");
		assert.equal(typeof mod.summarizeArgs, "function");
	});

	await t.test("exports getSlowThreshold", async () => {
		const mod = await import("./db-instrumentation.js");
		assert.equal(typeof mod.getSlowThreshold, "function");
	});

	await t.test("exports REDACTED_PLACEHOLDER", async () => {
		const mod = await import("./db-instrumentation.js");
		assert.equal(mod.REDACTED_PLACEHOLDER, "[REDACTED]");
	});

	await t.test("should return null when DB_INSTRUMENTATION is disabled", async () => {
		process.env.DB_INSTRUMENTATION = "false";
		const { createDbInstrumentation } = await import("./db-instrumentation.js");
		const result = createDbInstrumentation();
		assert.strictEqual(result, null);
	});

	await t.test("should return an extension object when instrumentation is enabled", async () => {
		process.env.DB_INSTRUMENTATION = "true";
		// Re-import to pick up updated env (module body is cached, but
		// isInstrumentationEnabled reads process.env each call).
		const { createDbInstrumentation } = await import("./db-instrumentation.js");
		const ext = createDbInstrumentation();
		assert.ok(ext, "expected non-null extension");
		assert.equal(ext.name, "quark-db-instrumentation");
		assert.equal(typeof ext.query.$allOperations, "function");
	});

	await t.test("maskSensitiveValues — redacts known sensitive keys", async () => {
		const { maskSensitiveValues, REDACTED_PLACEHOLDER } = await import(
			"./db-instrumentation.js"
		);

		const input = {
			email: "user@example.com",
			password: "supersecret",
			name: "Alice",
			token: "abc123",
			metadata: {
				apiKey: "sk-xxx",
				role: "admin",
			},
		};

		const result = maskSensitiveValues(input);

		assert.strictEqual(result.email, "user@example.com");
		assert.strictEqual(result.password, REDACTED_PLACEHOLDER);
		assert.strictEqual(result.name, "Alice");
		assert.strictEqual(result.token, REDACTED_PLACEHOLDER);
		assert.strictEqual(result.metadata.apiKey, REDACTED_PLACEHOLDER);
		assert.strictEqual(result.metadata.role, "admin");
	});

	await t.test("maskSensitiveValues — handles null/undefined/primitives", async () => {
		const { maskSensitiveValues } = await import("./db-instrumentation.js");

		assert.strictEqual(maskSensitiveValues(null), null);
		assert.strictEqual(maskSensitiveValues(undefined), undefined);
		assert.strictEqual(maskSensitiveValues(42), 42);
		assert.strictEqual(maskSensitiveValues("hello"), "hello");
	});

	await t.test("maskSensitiveValues — handles arrays", async () => {
		const { maskSensitiveValues, REDACTED_PLACEHOLDER } = await import(
			"./db-instrumentation.js"
		);

		const input = [
			{ password: "secret1", name: "A" },
			{ password: "secret2", name: "B" },
		];

		const result = maskSensitiveValues(input);

		assert.equal(result[0].password, REDACTED_PLACEHOLDER);
		assert.equal(result[0].name, "A");
		assert.equal(result[1].password, REDACTED_PLACEHOLDER);
		assert.equal(result[1].name, "B");
	});

	await t.test("maskSensitiveValues — deeply nested objects", async () => {
		const { maskSensitiveValues, REDACTED_PLACEHOLDER } = await import(
			"./db-instrumentation.js"
		);

		const input = {
			user: {
				profile: {
					hash: "abc",
					displayName: "Bob",
				},
			},
		};

		const result = maskSensitiveValues(input);

		assert.strictEqual(result.user.profile.hash, REDACTED_PLACEHOLDER);
		assert.strictEqual(result.user.profile.displayName, "Bob");
	});

	await t.test("isSensitiveKey — matches known patterns", async () => {
		const { isSensitiveKey } = await import("./db-instrumentation.js");

		assert.strictEqual(isSensitiveKey("password"), true);
		assert.strictEqual(isSensitiveKey("Password"), true);
		assert.strictEqual(isSensitiveKey("PASSWORD"), true);
		assert.strictEqual(isSensitiveKey("token"), true);
		assert.strictEqual(isSensitiveKey("api_key"), true);
		assert.strictEqual(isSensitiveKey("apiKey"), true);
		assert.strictEqual(isSensitiveKey("secret"), true);
		assert.strictEqual(isSensitiveKey("hash"), true);
		assert.strictEqual(isSensitiveKey("pin"), true);
		assert.strictEqual(isSensitiveKey("otp"), true);
		assert.strictEqual(isSensitiveKey("nonce"), true);
		assert.strictEqual(isSensitiveKey("signature"), true);
		assert.strictEqual(isSensitiveKey("csrf_token"), true);
		assert.strictEqual(isSensitiveKey("authorization"), true);
	});

	await t.test("isSensitiveKey — does not match safe keys", async () => {
		const { isSensitiveKey } = await import("./db-instrumentation.js");

		assert.strictEqual(isSensitiveKey("email"), false);
		assert.strictEqual(isSensitiveKey("name"), false);
		assert.strictEqual(isSensitiveKey("title"), false);
		assert.strictEqual(isSensitiveKey("description"), false);
		assert.strictEqual(isSensitiveKey("id"), false);
		assert.strictEqual(isSensitiveKey("createdAt"), false);
		assert.strictEqual(isSensitiveKey("updatedAt"), false);
		assert.strictEqual(isSensitiveKey("role"), false);
	});

	await t.test("summarizeArgs — masks sensitive fields", async () => {
		const { summarizeArgs, REDACTED_PLACEHOLDER } = await import(
			"./db-instrumentation.js"
		);

		const args = {
			where: { email: "test@test.com", password: "hunter2" },
			data: { name: "Test", token: "xyz" },
		};

		const result = summarizeArgs(args);

		assert.strictEqual(result.where.email, "test@test.com");
		assert.strictEqual(result.where.password, REDACTED_PLACEHOLDER);
		assert.strictEqual(result.data.name, "Test");
		assert.strictEqual(result.data.token, REDACTED_PLACEHOLDER);
	});

	await t.test("summarizeArgs — truncates large objects", async () => {
		const { summarizeArgs } = await import("./db-instrumentation.js");

		const largeWhere = {};
		for (let i = 0; i < 20; i++) {
			largeWhere[`field_${i}`] = `value_${i}`;
		}

		const args = { where: largeWhere };
		const result = summarizeArgs(args);

		// Should have at most 5 keys (3 truncated + the "[+N more]" marker)
		const keyCount = Object.keys(result.where).length;
		assert.ok(keyCount <= 5, `Expected ≤5 keys, got ${keyCount}`);
		assert.ok("[+17 more]" in result.where || "[+11 more]" in result.where);
	});

	await t.test("summarizeArgs — returns empty object for null/undefined", async () => {
		const { summarizeArgs } = await import("./db-instrumentation.js");

		assert.deepStrictEqual(summarizeArgs(null), {});
		assert.deepStrictEqual(summarizeArgs(undefined), {});
	});

	await t.test("getSlowThreshold — reads from env", async () => {
		const { getSlowThreshold } = await import("./db-instrumentation.js");

		process.env.DB_SLOW_QUERY_THRESHOLD = "2000";
		assert.strictEqual(getSlowThreshold(), 2000);

		process.env.DB_SLOW_QUERY_THRESHOLD = "-1";
		assert.strictEqual(getSlowThreshold(), 500); // fallback to default

		delete process.env.DB_SLOW_QUERY_THRESHOLD;
		assert.strictEqual(getSlowThreshold(), 500); // fallback to default
	});

	await t.test("$allOperations — calls query and returns result", async () => {
		process.env.DB_INSTRUMENTATION = "true";
		const { createDbInstrumentation } = await import("./db-instrumentation.js");
		const ext = createDbInstrumentation();

		const expected = { id: 1, email: "test@test.com" };
		const params = {
			model: "User",
			operation: "findUnique",
			args: { where: { id: 1 } },
			query: mock.fn(async () => expected),
		};

		const result = await ext.query.$allOperations(params);

		assert.strictEqual(result, expected);
		assert.equal(params.query.mock.callCount(), 1);
	});

	await t.test("$allOperations — still returns result on query error (finally block)", async () => {
		process.env.DB_INSTRUMENTATION = "true";
		const { createDbInstrumentation } = await import("./db-instrumentation.js");
		const ext = createDbInstrumentation();

		const queryError = new Error("DB failure");
		const params = {
			model: "User",
			operation: "create",
			args: { data: { email: "test@test.com" } },
			query: mock.fn(async () => {
				throw queryError;
			}),
		};

		await assert.rejects(
			() => ext.query.$allOperations(params),
			(error) => error === queryError,
		);
	});
});
