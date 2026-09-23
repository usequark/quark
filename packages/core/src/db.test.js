import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
	createPrismaClient,
	getConnectionString,
	getPoolConfig,
	pingDatabase,
} from "./db.js";

// ---------------------------------------------------------------------------
// getConnectionString
// ---------------------------------------------------------------------------

test("db - getConnectionString returns DATABASE_URL when set", () => {
	const orig = process.env.DATABASE_URL;
	try {
		process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";
		const conn = getConnectionString();
		assert.equal(conn, "postgresql://user:pass@host:5432/db");
	} finally {
		if (orig === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = orig;
	}
});

test("db - getConnectionString assembles from POSTGRES_* vars", () => {
	const backup = {};
	const vars = [
		"DATABASE_URL",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_HOST",
		"POSTGRES_PORT",
		"POSTGRES_DB",
	];
	for (const v of vars) {
		backup[v] = process.env[v];
		delete process.env[v];
	}
	try {
		process.env.POSTGRES_USER = "alice";
		process.env.POSTGRES_PASSWORD = "secret";
		process.env.POSTGRES_HOST = "db.example.com";
		process.env.POSTGRES_PORT = "5433";
		process.env.POSTGRES_DB = "mydb";
		const conn = getConnectionString();
		assert.equal(
			conn,
			"postgresql://alice:secret@db.example.com:5433/mydb?schema=public",
		);
	} finally {
		for (const v of vars) {
			if (backup[v] === undefined) delete process.env[v];
			else process.env[v] = backup[v];
		}
	}
});

test("db - getConnectionString defaults host/port when POSTGRES_HOST/PORT not set", () => {
	const backup = {};
	const vars = [
		"DATABASE_URL",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DB",
		"POSTGRES_HOST",
		"POSTGRES_PORT",
	];
	for (const v of vars) {
		backup[v] = process.env[v];
		delete process.env[v];
	}
	try {
		process.env.POSTGRES_USER = "u";
		process.env.POSTGRES_PASSWORD = "p";
		process.env.POSTGRES_DB = "d";
		const conn = getConnectionString();
		assert.equal(conn, "postgresql://u:p@localhost:5432/d?schema=public");
	} finally {
		for (const v of vars) {
			if (backup[v] === undefined) delete process.env[v];
			else process.env[v] = backup[v];
		}
	}
});

test("db - getConnectionString throws when throwOnMissing=true and vars missing", () => {
	const backup = {};
	const vars = [
		"DATABASE_URL",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DB",
	];
	for (const v of vars) {
		backup[v] = process.env[v];
		delete process.env[v];
	}
	try {
		assert.throws(
			() => getConnectionString({ throwOnMissing: true }),
			/Missing required database environment variables/,
		);
	} finally {
		for (const v of vars) {
			if (backup[v] === undefined) delete process.env[v];
			else process.env[v] = backup[v];
		}
	}
});

test("db - getConnectionString returns placeholder when throwOnMissing=false and vars missing", () => {
	const backup = {};
	const vars = [
		"DATABASE_URL",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DB",
	];
	for (const v of vars) {
		backup[v] = process.env[v];
		delete process.env[v];
	}
	try {
		const conn = getConnectionString({ throwOnMissing: false });
		assert.ok(conn.includes("placeholder"));
	} finally {
		for (const v of vars) {
			if (backup[v] === undefined) delete process.env[v];
			else process.env[v] = backup[v];
		}
	}
});

// ---------------------------------------------------------------------------
// getPoolConfig
// ---------------------------------------------------------------------------

test("db - getPoolConfig returns production defaults in production", () => {
	const orig = process.env.NODE_ENV;
	const origMax = process.env.DB_POOL_MAX;
	const origIdle = process.env.DB_POOL_IDLE_TIMEOUT;
	const origConn = process.env.DB_POOL_CONNECTION_TIMEOUT;
	try {
		process.env.NODE_ENV = "production";
		delete process.env.DB_POOL_MAX;
		delete process.env.DB_POOL_IDLE_TIMEOUT;
		delete process.env.DB_POOL_CONNECTION_TIMEOUT;
		const config = getPoolConfig();
		assert.equal(config.max, 10);
		assert.equal(config.idleTimeoutMillis, 30_000);
		assert.equal(config.connectionTimeoutMillis, 5_000);
	} finally {
		if (orig === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = orig;
		if (origMax === undefined) delete process.env.DB_POOL_MAX;
		else process.env.DB_POOL_MAX = origMax;
		if (origIdle === undefined) delete process.env.DB_POOL_IDLE_TIMEOUT;
		else process.env.DB_POOL_IDLE_TIMEOUT = origIdle;
		if (origConn === undefined) delete process.env.DB_POOL_CONNECTION_TIMEOUT;
		else process.env.DB_POOL_CONNECTION_TIMEOUT = origConn;
	}
});

test("db - getPoolConfig returns dev defaults in development", () => {
	const orig = process.env.NODE_ENV;
	const origMax = process.env.DB_POOL_MAX;
	try {
		process.env.NODE_ENV = "development";
		delete process.env.DB_POOL_MAX;
		const config = getPoolConfig();
		assert.equal(config.max, 5);
	} finally {
		if (orig === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = orig;
		if (origMax === undefined) delete process.env.DB_POOL_MAX;
		else process.env.DB_POOL_MAX = origMax;
	}
});

test("db - getPoolConfig respects DB_POOL_MAX override", () => {
	const orig = process.env.DB_POOL_MAX;
	try {
		process.env.DB_POOL_MAX = "20";
		const config = getPoolConfig();
		assert.equal(config.max, 20);
	} finally {
		if (orig === undefined) delete process.env.DB_POOL_MAX;
		else process.env.DB_POOL_MAX = orig;
	}
});

// ---------------------------------------------------------------------------
// createPrismaClient
// ---------------------------------------------------------------------------

test("db - createPrismaClient returns a proxy", () => {
	class FakeClient {
		constructor(opts) {
			this.opts = opts;
		}
		get user() {
			return { findMany: () => [] };
		}
	}

	const client = createPrismaClient(FakeClient);
	// Proxy should be an object
	assert.equal(typeof client, "object");
	delete globalThis.__quark_prisma_FakeClient;
});

test("db - createPrismaClient defers instantiation until first access", () => {
	let constructed = false;
	class TrackingClient {
		constructor() {
			constructed = true;
		}
		get ready() {
			return true;
		}
	}

	const client = createPrismaClient(TrackingClient);
	assert.equal(constructed, false, "should not construct at creation time");

	// Access a property to trigger construction
	const _ = client.ready;
	assert.equal(constructed, true, "should construct on first access");
	delete globalThis.__quark_prisma_TrackingClient;
});

test("db - createPrismaClient passes adapterOptions to constructor", () => {
	let receivedOpts;
	class OptsClient {
		constructor(opts) {
			receivedOpts = opts;
		}
		get check() {
			return true;
		}
	}

	// Reset global
	delete globalThis.__quark_prisma_OptsClient;

	const client = createPrismaClient(OptsClient, {
		adapterOptions: { connectionString: "test" },
	});
	const _ = client.check;
	assert.deepEqual(receivedOpts, { connectionString: "test" });
	delete globalThis.__quark_prisma_OptsClient;
});

test("db - createPrismaClient keeps a separate slot per client class", () => {
	class AlphaClient {
		get marker() {
			return "alpha";
		}
	}
	class BetaClient {
		get marker() {
			return "beta";
		}
	}

	try {
		const alpha = createPrismaClient(AlphaClient);
		const beta = createPrismaClient(BetaClient);
		assert.equal(alpha.marker, "alpha");
		assert.equal(beta.marker, "beta");
	} finally {
		delete globalThis.__quark_prisma_AlphaClient;
		delete globalThis.__quark_prisma_BetaClient;
	}
});

test("db - createPrismaClient honours an explicit globalKey", () => {
	const globalKey = "__quark_prisma_test_explicit";
	class FirstClient {
		get marker() {
			return 1;
		}
	}
	class SecondClient {
		get marker() {
			return 2;
		}
	}

	try {
		const first = createPrismaClient(FirstClient, { globalKey });
		assert.equal(first.marker, 1);

		// Same explicit slot → the existing client wins (singleton semantics)
		const second = createPrismaClient(SecondClient, { globalKey });
		assert.equal(second.marker, 1);
	} finally {
		delete globalThis[globalKey];
	}
});

test("db - createPrismaClient supports a named slot for same-named classes", () => {
	class PrismaClient {
		get marker() {
			return "primary";
		}
	}
	class OtherPrismaClient {
		get marker() {
			return "secondary";
		}
	}

	try {
		const primary = createPrismaClient(PrismaClient, { name: "primary" });
		const secondary = createPrismaClient(OtherPrismaClient, {
			name: "secondary",
		});
		assert.equal(primary.marker, "primary");
		assert.equal(secondary.marker, "secondary");
	} finally {
		delete globalThis.__quark_prisma_primary;
		delete globalThis.__quark_prisma_secondary;
	}
});

// ---------------------------------------------------------------------------
// pingDatabase
// ---------------------------------------------------------------------------

test("db - pingDatabase reports ok or error without throwing", async () => {
	// This test verifies the error-handling path.  In most CI environments
	// pg IS installed, so we test the general error handling by verifying
	// the function never throws.
	const result = await pingDatabase({ timeout: 1000 });
	assert.ok(result);
	assert.ok(["ok", "error"].includes(result.status));
	if (result.status === "error") {
		assert.equal(typeof result.message, "string");
	}
});

// Copy db.js to a directory with no node_modules so `pg` is unresolvable and
// prove that the optional peer dependency surfaces as an error result rather
// than an import-time/build-time failure.
test("db - pingDatabase reports a missing pg install without throwing", async () => {
	const dir = await mkdtemp(join(tmpdir(), "quark-db-"));
	try {
		await copyFile(new URL("./db.js", import.meta.url), join(dir, "db.js"));

		const isolated = await import(pathToFileURL(join(dir, "db.js")).href);
		const result = await isolated.pingDatabase({ timeout: 500 });

		assert.equal(result.status, "error");
		assert.match(result.message, /pg is not installed/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
