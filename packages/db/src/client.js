import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

// Construct DATABASE_URL from individual env vars (mirrors prisma.config.ts)
const user = process.env.POSTGRES_USER || "quark_user";
const password = process.env.POSTGRES_PASSWORD || "quark_password";
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const db = process.env.POSTGRES_DB || "quark_dev";
const connectionString = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;

const isProduction = process.env.NODE_ENV === "production";

/**
 * Returns the connection pool configuration for the `pg` driver.
 *
 * Reads from environment variables with sensible defaults:
 * - `DB_POOL_MAX` — maximum number of connections (default: 10 in production, 5 in development)
 * - `DB_POOL_IDLE_TIMEOUT` — milliseconds before an idle connection is closed (default: 30 000)
 * - `DB_POOL_CONNECTION_TIMEOUT` — milliseconds to wait for a new connection (default: 5 000)
 *
 * @returns {{ max: number, idleTimeoutMillis: number, connectionTimeoutMillis: number }}
 */
export function getPoolConfig() {
	return {
		max: Number(process.env.DB_POOL_MAX) || (isProduction ? 10 : 5),
		idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT) || 30_000,
		connectionTimeoutMillis:
			Number(process.env.DB_POOL_CONNECTION_TIMEOUT) || 5_000,
	};
}

// Create a singleton Prisma client with the PostgreSQL driver adapter and pool settings
const globalForPrisma = globalThis;
export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		adapter: new PrismaPg({
			connectionString,
			...getPoolConfig(),
		}),
	});

if (!isProduction) {
	globalForPrisma.prisma = prisma;
}

export * from "./generated/prisma/client.ts";
