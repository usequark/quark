import { PrismaPg } from "@prisma/adapter-pg";
import { getConnectionString } from "./connection.js";
import { PrismaClient } from "./generated/prisma/client.ts";

/**
 * Returns the connection pool configuration for the `pg` driver.
 *
 * Reads from environment variables with sensible defaults:
 * - `DB_POOL_MAX` - maximum number of connections (default: 10 in production, 5 in development)
 * - `DB_POOL_IDLE_TIMEOUT` - milliseconds before an idle connection is closed (default: 30 000)
 * - `DB_POOL_CONNECTION_TIMEOUT` - milliseconds to wait for a new connection (default: 5 000)
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

// Lazy singleton - the client is created on first property access, not at import time.
// This allows Next.js to import the module at build time without requiring DB env vars.
const globalForPrisma = globalThis;

function getPrismaClient() {
	if (!globalForPrisma.__prisma) {
		const baseClient = new PrismaClient({
			adapter: new PrismaPg({
				connectionString: getConnectionString(),
				...getPoolConfig(),
			}),
		});

		// Assign base client immediately so the proxy never blocks.
		globalForPrisma.__prisma = baseClient;

		// Apply optional query instrumentation extension from @usequark/quark-core.
		// Loaded asynchronously — the base client is used in the meantime, then
		// upgraded in-place once the extension module arrives.
		// The extension handles slow-query logging, argument masking, and Prometheus
		// metrics.  It is schema-agnostic and respects the DB_INSTRUMENTATION env var.
		import("@usequark/quark-core")
			.then(({ createDbInstrumentation }) => {
				const ext = createDbInstrumentation();
				if (ext) {
					globalForPrisma.__prisma = baseClient.$extends(ext);
				}
			})
			.catch(() => {
				// @usequark/quark-core not available or old version — base client remains.
			});
	}
	return globalForPrisma.__prisma;
}

/**
 * Prisma client singleton. Lazily initialized on first use so the module
 * can be imported safely at build time (no DB env vars needed).
 *
 * Methods are bound to the real client so `this` inside Prisma internals is
 * always the PrismaClient instance, never the Proxy wrapper.
 */
export const prisma = new Proxy(/** @type {PrismaClient} */ ({}), {
	get(_target, prop) {
		const client = getPrismaClient();
		const value = client[prop];
		return typeof value === "function" ? value.bind(client) : value;
	},
});

export * from "./generated/prisma/client.ts";
