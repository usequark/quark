import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env from monorepo root
config({ path: resolve(__dirname, "../../.env") });

// Construct DATABASE_URL from individual env vars - single source of truth
const user = process.env.POSTGRES_USER || "quark_user";
const password = process.env.POSTGRES_PASSWORD || "quark_password";
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const db = process.env.POSTGRES_DB || "quark_dev";

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
