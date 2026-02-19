/**
 * Shared connection string builder for PostgreSQL.
 * Used by both the Prisma client (client.js) and Prisma CLI (prisma.config.ts).
 *
 * Priority: DATABASE_URL env var → assembled from POSTGRES_* env vars.
 *
 * @param {{ throwOnMissing?: boolean }} [options]
 *   - throwOnMissing=true  (default) — runtime: throws if credentials are missing.
 *   - throwOnMissing=false — CLI/CI: returns a placeholder URL so `prisma generate` works.
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

		// Placeholder for prisma generate / CI — will fail at connect time, not at config time.
		return "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";
	}

	return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}
