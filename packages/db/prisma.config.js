import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";
import { getConnectionString } from "./src/connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root (needed for standalone commands like db:push, db:seed)
try {
	process.loadEnvFile(resolve(__dirname, "../../.env"));
} catch {}

// Use shared connection builder - throwOnMissing=false so `prisma generate` works
// even without database credentials (e.g. in CI). Commands that need a real
// connection (migrate, push, studio) will fail at connect time.
const databaseUrl = getConnectionString({ throwOnMissing: false });

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx prisma/seed.js",
	},
	datasource: {
		url: databaseUrl,
	},
});
