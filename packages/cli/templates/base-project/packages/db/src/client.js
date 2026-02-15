import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

// Construct DATABASE_URL from individual env vars (mirrors prisma.config.ts)
// POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB are required — no silent fallbacks.
const user = process.env.POSTGRES_USER;
if (!user) throw new Error("POSTGRES_USER environment variable is required");
const password = process.env.POSTGRES_PASSWORD;
if (!password)
	throw new Error("POSTGRES_PASSWORD environment variable is required");
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const db = process.env.POSTGRES_DB;
if (!db) throw new Error("POSTGRES_DB environment variable is required");
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
