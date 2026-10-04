/**
 * @usequark/quark-core - Database Utilities
 *
 * Shared Prisma client singleton, connection-string builder, pool config,
 * and a lightweight health-check ping.  These replace the per-project
 * re-implementations in Regina / Pawdora / Trenchmate.
 *
 * Usage:
 *   import { createPrismaClient, getConnectionString, pingDatabase } from "@usequark/quark-core/db";
 */

// ---------------------------------------------------------------------------
// Connection String
// ---------------------------------------------------------------------------

/**
 * Builds a PostgreSQL connection string from environment variables.
 *
 * Priority: DATABASE_URL → assembled from POSTGRES_* vars.
 *
 * @param {{ throwOnMissing?: boolean }} [options]
 * @returns {string} PostgreSQL connection string
 */
export function getConnectionString({ throwOnMissing = true } = {}) {
	// 1. Prefer an explicit DATABASE_URL if set
	if (process.env.DATABASE_URL) {
		return process.env.DATABASE_URL;
	}

	// 2. Assemble from individual POSTGRES_* vars
	const user = process.env.POSTGRES_USER;
	const password = process.env.POSTGRES_PASSWORD;
	const host = process.env.POSTGRES_HOST || "localhost";
	const port = process.env.POSTGRES_PORT || "5432";
	const db = process.env.POSTGRES_DB;

	const hasCredentials = user && password && db;

	if (!hasCredentials) {
		if (throwOnMissing) {
			const missing = [];
			if (!user) missing.push("POSTGRES_USER");
			if (!password) missing.push("POSTGRES_PASSWORD");
			if (!db) missing.push("POSTGRES_DB");
			throw new Error(
				`Missing required database environment variables: ${missing.join(", ")}. ` +
					"Set DATABASE_URL or the individual POSTGRES_* variables.",
			);
		}

		// Placeholder for prisma generate / CI
		return "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";
	}

	return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

// ---------------------------------------------------------------------------
// Pool Config
// ---------------------------------------------------------------------------

/**
 * Returns the connection pool configuration for the `pg` driver.
 *
 * Reads from environment variables with sensible defaults:
 *   DB_POOL_MAX               – max connections (default: 10 prod / 5 dev)
 *   DB_POOL_IDLE_TIMEOUT      – idle timeout ms  (default: 30 000)
 *   DB_POOL_CONNECTION_TIMEOUT – connect timeout ms (default: 5 000)
 *
 * @returns {{ max: number, idleTimeoutMillis: number, connectionTimeoutMillis: number }}
 */
export function getPoolConfig() {
	const isProduction = process.env.NODE_ENV === "production";
	return {
		max: Number(process.env.DB_POOL_MAX) || (isProduction ? 10 : 5),
		idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT) || 30_000,
		connectionTimeoutMillis:
			Number(process.env.DB_POOL_CONNECTION_TIMEOUT) || 5_000,
	};
}

// ---------------------------------------------------------------------------
// Prisma Client Singleton
// ---------------------------------------------------------------------------

/**
 * Creates a lazy Prisma client singleton that is safe to import at build
 * time (no DB connection is made until the first property access).
 *
 * The singleton is stored on `globalThis` so it survives hot-reloads in
 * development and is shared across lazy imports in a monorepo. The slot is
 * namespaced per client (`__quark_prisma_<name>`) so two different Prisma
 * clients in the same process do not silently share one instance.
 *
 * @template T - PrismaClient subclass
 * @param {new (...args: any[]) => T} ClientClass - The PrismaClient constructor
 * @param {Object} [options]
 * @param {Array<(client: T) => T>} [options.$extends] - Extension functions applied to the client
 * @param {Record<string, any>} [options.adapterOptions] - Extra options passed to the ClientClass constructor
 * @param {string} [options.name] - Singleton namespace; defaults to the ClientClass name
 * @param {string} [options.globalKey] - Full override for the `globalThis` key
 * @returns {T} Proxy that defers initialization until first use
 */
export function createPrismaClient(ClientClass, options = {}) {
	const globalKey =
		options.globalKey ||
		`__quark_prisma_${options.name || ClientClass?.name || "default"}`;

	/**
	 * Returns the real client, creating it on first access.
	 * @returns {T}
	 */
	function getClient() {
		if (globalThis[globalKey]) return globalThis[globalKey];

		let client = new ClientClass(options.adapterOptions ?? {});

		// Apply $extends chain if provided
		if (options.$extends?.length) {
			for (const ext of options.$extends) {
				client = ext(client);
			}
		}

		globalThis[globalKey] = client;
		return client;
	}

	// Proxy-based deferred init — methods are bound on first access so the
	// caller never notices the lazy instantiation.
	return new Proxy(/** @type {T} */ ({}), {
		get(_target, prop, receiver) {
			const client = getClient();
			const value = Reflect.get(client, prop, receiver);
			return typeof value === "function" ? value.bind(client) : value;
		},
		has(_target, prop) {
			return prop in getClient();
		},
		ownKeys() {
			return Reflect.ownKeys(getClient());
		},
		getOwnPropertyDescriptor(_target, prop) {
			return Reflect.getOwnPropertyDescriptor(getClient(), prop);
		},
	});
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Pings PostgreSQL to verify connectivity.
 * Uses a raw `pg.Client` directly so the check is immune to Prisma adapter
 * quirks.  `pg` is an optional peer dependency that is dynamically imported
 * so importing this module (which the `.` and `./core` barrels re-export)
 * does not require it to be installed. The import is marked `webpackIgnore`
 * so bundlers keep it as a runtime import instead of failing the build when
 * `pg` is absent.
 *
 * @param {object} [options]
 * @param {number} [options.timeout=3000] - Connection/query timeout in ms.
 * @returns {Promise<{ status: "ok", latencyMs: number } | { status: "error", message: string }>}
 */
export async function pingDatabase({ timeout = 3000 } = {}) {
	/** @type {import("pg").Client | null} */
	let client = null;
	let connectionString;

	try {
		const { default: pg } = await import(/* webpackIgnore: true */ "pg");
		connectionString = getConnectionString();

		client = new pg.Client({
			connectionString,
			connectionTimeoutMillis: timeout,
			query_timeout: timeout,
		});

		await client.connect();

		const start = performance.now();
		await client.query("SELECT 1");
		const latencyMs = Math.round(performance.now() - start);

		return { status: "ok", latencyMs };
	} catch (error) {
		let message;
		if (
			error?.code === "MODULE_NOT_FOUND" ||
			error?.code === "ERR_MODULE_NOT_FOUND"
		) {
			message = "pg is not installed";
		} else if (
			error?.code === "ECONNREFUSED" ||
			/ECONNREFUSED/i.test(error?.message ?? "")
		) {
			try {
				const { hostname, port } = new URL(connectionString);
				message = `PostgreSQL unreachable at ${hostname}:${port || "5432"}`;
			} catch {
				message = "PostgreSQL unreachable";
			}
		} else if (error?.code === "ENOTFOUND") {
			message = `PostgreSQL host not found: ${error.hostname ?? "unknown"}`;
		} else {
			message = error?.message ?? String(error);
		}
		return { status: "error", message };
	} finally {
		try {
			await client?.end();
		} catch {
			// ignore disconnect errors
		}
	}
}
