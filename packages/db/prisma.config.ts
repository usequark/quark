import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env from monorepo root (needed for standalone commands like db:push, db:seed)
config({ path: resolve(__dirname, "../../.env"), quiet: true });

// Construct DATABASE_URL from individual env vars - single source of truth
const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const db = process.env.POSTGRES_DB;

if (!user || !password || !db) {
	throw new Error(
		"Missing required Postgres env vars: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB. " +
			"Copy .env.example to .env and fill in the values.",
	);
}

const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: databaseUrl,
	},
});
