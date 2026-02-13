import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

// Construct DATABASE_URL from individual env vars (mirrors prisma.config.ts)
const user = process.env.POSTGRES_USER || "quark";
const password = process.env.POSTGRES_PASSWORD || "development";
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const db = process.env.POSTGRES_DB || "myapp_dev";
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

export * from "./generated/prisma/client.js";
