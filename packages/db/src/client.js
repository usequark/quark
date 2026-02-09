import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

// Construct DATABASE_URL from individual env vars (mirrors prisma.config.ts)
const user = process.env.POSTGRES_USER || "quark_user";
const password = process.env.POSTGRES_PASSWORD || "quark_password";
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const db = process.env.POSTGRES_DB || "quark_dev";
const connectionString = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;

// Create a singleton Prisma client with the PostgreSQL driver adapter
const globalForPrisma = globalThis;
export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		adapter: new PrismaPg({ connectionString }),
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

export * from "./generated/prisma/client.ts";
