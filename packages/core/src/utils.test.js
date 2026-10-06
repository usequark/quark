import assert from "node:assert";
import { test } from "node:test";
import {
	debounce,
	deepMerge,
	formatBytes,
	isObject,
	memoize,
	normalizeErrorMessage,
	randomString,
	redactUrl,
	retryAsync,
	sanitizeId,
	sleep,
	validateEnv,
} from "../src/utils.js";

test("Utils Module", async (t) => {
	await t.test("retryAsync succeeds on first attempt", async () => {
		let attempts = 0;
		const result = await retryAsync(async () => {
			attempts++;
			return "success";
		});

		assert(result === "success");
		assert(attempts === 1);
	});

	await t.test("retryAsync retries on failure", async () => {
		let attempts = 0;
		const result = await retryAsync(
			async () => {
				attempts++;
				if (attempts < 3) throw new Error("Fail");
				return "success";
			},
			{ maxAttempts: 5, initialDelay: 10 },
		);

		assert(result === "success");
		assert(attempts === 3);
	});

	await t.test("retryAsync throws after max attempts", async () => {
		let attempts = 0;
		await assert.rejects(async () => {
			await retryAsync(
				async () => {
					attempts++;
					throw new Error("Always fails");
				},
				{ maxAttempts: 3, initialDelay: 10 },
			);
		});

		assert(attempts === 3);
	});

	await t.test("sleep delays execution", async () => {
		const start = Date.now();
		await sleep(50);
		const elapsed = Date.now() - start;
		assert(elapsed >= 40); // Allow some variance
	});

	await t.test("validateEnv checks required variables", () => {
		process.env.TEST_VAR = "test";
		assert(validateEnv(["TEST_VAR"]) === true);
	});

	await t.test("validateEnv throws on missing variables", () => {
		assert.throws(() => {
			validateEnv(["NONEXISTENT_VAR_12345"]);
		});
	});

	await t.test("deepMerge merges objects", () => {
		const result = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 });

		assert.deepStrictEqual(result, {
			a: 1,
			b: { c: 2, d: 3 },
			e: 4,
		});
	});

	await t.test("deepMerge handles nested objects", () => {
		const result = deepMerge({ a: { b: { c: 1 } } }, { a: { b: { d: 2 } } });

		assert.deepStrictEqual(result, {
			a: { b: { c: 1, d: 2 } },
		});
	});

	await t.test("isObject identifies objects", () => {
		assert(isObject({}));
		assert(isObject({ a: 1 }));
		assert(!isObject([]));
		assert(!isObject(null));
		assert(!isObject("string"));
		assert(!isObject(123));
	});

	await t.test("normalizeErrorMessage handles various types", () => {
		assert(normalizeErrorMessage("string") === "string");
		assert(normalizeErrorMessage(new Error("error")) === "error");
		assert(normalizeErrorMessage({ message: "msg" }) === "msg");
		assert(normalizeErrorMessage(null).includes("unknown"));
	});

	await t.test("randomString generates random strings", () => {
		const str1 = randomString(16);
		const str2 = randomString(16);

		assert(str1.length === 16);
		assert(str2.length === 16);
		// Very unlikely to be equal
		assert(str1 !== str2);
	});

	await t.test("randomString respects length parameter", () => {
		assert(randomString(10).length === 10);
		assert(randomString(50).length === 50);
	});

	await t.test("sanitizeId converts to valid IDs", () => {
		assert(sanitizeId("Hello World") === "hello-world");
		assert(sanitizeId("Test_123") === "test-123");
		assert(sanitizeId("---hello---") === "hello");
		assert(sanitizeId("UPPERCASE") === "uppercase");
	});

	await t.test("formatBytes formats file sizes", () => {
		assert(formatBytes(0) === "0 Bytes");
		assert(formatBytes(1024) === "1 KB");
		assert(formatBytes(1024 * 1024) === "1 MB");
		assert(formatBytes(1024 * 1024 * 1024) === "1 GB");
	});

	await t.test("debounce delays function execution", (_t, done) => {
		let callCount = 0;
		const debounced = debounce(() => {
			callCount++;
		}, 30);

		debounced();
		debounced();
		debounced();

		assert(callCount === 0); // Not called yet

		setTimeout(() => {
			assert(callCount === 1); // Called once after delay
			done();
		}, 50);
	});

	await t.test("memoize caches function results", () => {
		let callCount = 0;
		const memoized = memoize((x) => {
			callCount++;
			return x * 2;
		});

		assert(memoized(5) === 10);
		assert(callCount === 1);
		assert(memoized(5) === 10);
		assert(callCount === 1); // Same result from cache

		assert(memoized(10) === 20);
		assert(callCount === 2); // Different input, new call
	});

	await t.test("memoize respects TTL", (_t, done) => {
		let callCount = 0;
		const memoized = memoize(
			(x) => {
				callCount++;
				return x * 2;
			},
			30, // 30ms TTL
		);

		assert(memoized(5) === 10);
		assert(callCount === 1);

		setTimeout(() => {
			assert(memoized(5) === 10);
			assert(callCount === 2); // Cache expired, new call
			done();
		}, 50);
	});
});

test("redactUrl", async (t) => {
	await t.test("strips username and password from a parseable URL", () => {
		const result = redactUrl("redis://default:hunter2@cache.internal:6379");

		assert(!result.includes("hunter2"), `password leaked: ${result}`);
		assert(!result.includes("default"), `username leaked: ${result}`);
		assert(result.includes("cache.internal"));
		assert(result.includes("6379"));
	});

	await t.test("strips a password-only credential", () => {
		const result = redactUrl("redis://:hunter2@cache.internal:6379");

		assert(!result.includes("hunter2"), `password leaked: ${result}`);
		assert(result.includes("cache.internal"));
	});

	await t.test("strips credentials from a postgres URL", () => {
		const result = redactUrl(
			"postgresql://app:s3cret@db.internal:5432/app?schema=public",
		);

		assert(!result.includes("s3cret"), `password leaked: ${result}`);
		assert(result.includes("db.internal"));
		assert(result.includes("schema=public"));
	});

	await t.test("redacts the userinfo of a URL it cannot parse", () => {
		const result = redactUrl("redis://user:hunter2@cache internal:6379");

		assert(!result.includes("hunter2"), `password leaked: ${result}`);
	});

	await t.test("leaves a credential-free URL untouched", () => {
		const url = "redis://cache.internal:6379";

		assert(redactUrl(url) === url);
	});

	await t.test("passes through non-URL and empty values", () => {
		assert(redactUrl("not-a-url") === "not-a-url");
		assert(redactUrl("") === "");
		assert(redactUrl(undefined) === undefined);
		assert(redactUrl(null) === null);
	});
});
