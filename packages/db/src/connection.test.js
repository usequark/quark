import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import { getConnectionString } from "./connection.js";

describe("getConnectionString", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Clear all DB-related env vars before each test
		delete process.env.DATABASE_URL;
		delete process.env.POSTGRES_USER;
		delete process.env.POSTGRES_PASSWORD;
		delete process.env.POSTGRES_HOST;
		delete process.env.POSTGRES_PORT;
		delete process.env.POSTGRES_DB;
	});

	afterEach(() => {
		// Restore original env
		process.env = { ...originalEnv };
	});

	test("returns DATABASE_URL when set", () => {
		process.env.DATABASE_URL =
			"postgresql://user:pass@remote:5433/mydb?schema=public";
		const url = getConnectionString();
		assert.strictEqual(url, process.env.DATABASE_URL);
	});

	test("DATABASE_URL takes priority over individual POSTGRES_* vars", () => {
		process.env.DATABASE_URL =
			"postgresql://url_user:url_pass@remote:5433/url_db?schema=public";
		process.env.POSTGRES_USER = "individual_user";
		process.env.POSTGRES_PASSWORD = "individual_pass";
		process.env.POSTGRES_DB = "individual_db";

		const url = getConnectionString();
		assert.strictEqual(url, process.env.DATABASE_URL);
	});

	test("assembles from POSTGRES_* vars when DATABASE_URL is not set", () => {
		process.env.POSTGRES_USER = "test_user";
		process.env.POSTGRES_PASSWORD = "test_pass";
		process.env.POSTGRES_DB = "test_db";

		const url = getConnectionString();
		assert.strictEqual(
			url,
			"postgresql://test_user:test_pass@localhost:5432/test_db?schema=public",
		);
	});

	test("uses custom host and port when provided", () => {
		process.env.POSTGRES_USER = "user";
		process.env.POSTGRES_PASSWORD = "pass";
		process.env.POSTGRES_HOST = "db.example.com";
		process.env.POSTGRES_PORT = "5433";
		process.env.POSTGRES_DB = "mydb";

		const url = getConnectionString();
		assert.strictEqual(
			url,
			"postgresql://user:pass@db.example.com:5433/mydb?schema=public",
		);
	});

	test("throws when POSTGRES_USER is missing (throwOnMissing=true)", () => {
		process.env.POSTGRES_PASSWORD = "pass";
		process.env.POSTGRES_DB = "db";

		assert.throws(() => getConnectionString(), {
			message: /POSTGRES_USER/,
		});
	});

	test("throws when POSTGRES_PASSWORD is missing (throwOnMissing=true)", () => {
		process.env.POSTGRES_USER = "user";
		process.env.POSTGRES_DB = "db";

		assert.throws(() => getConnectionString(), {
			message: /POSTGRES_PASSWORD/,
		});
	});

	test("throws when POSTGRES_DB is missing (throwOnMissing=true)", () => {
		process.env.POSTGRES_USER = "user";
		process.env.POSTGRES_PASSWORD = "pass";

		assert.throws(() => getConnectionString(), {
			message: /POSTGRES_DB/,
		});
	});

	test("lists all missing vars in error message", () => {
		assert.throws(() => getConnectionString(), {
			message: /POSTGRES_USER.*POSTGRES_PASSWORD.*POSTGRES_DB/,
		});
	});

	test("returns placeholder when throwOnMissing=false and vars missing", () => {
		const url = getConnectionString({ throwOnMissing: false });
		assert.strictEqual(
			url,
			"postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public",
		);
	});

	test("still assembles correctly with throwOnMissing=false when vars present", () => {
		process.env.POSTGRES_USER = "user";
		process.env.POSTGRES_PASSWORD = "pass";
		process.env.POSTGRES_DB = "db";

		const url = getConnectionString({ throwOnMissing: false });
		assert.strictEqual(
			url,
			"postgresql://user:pass@localhost:5432/db?schema=public",
		);
	});
});
