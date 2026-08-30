import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
	if (!db) {
		db = await SQLite.openDatabaseAsync("quark-cache.db");
		await db.execAsync(`
			CREATE TABLE IF NOT EXISTS cache (
				key TEXT PRIMARY KEY NOT NULL,
				value TEXT NOT NULL,
				expiresAt INTEGER NOT NULL,
				createdAt INTEGER NOT NULL DEFAULT (unixepoch())
			);
		`);
	}
	return db;
}

interface CacheEntry {
	value: string;
	expiresAt: number;
}

const DEFAULT_TTL = 60_000;

/**
 * Get a cached value by key. Returns null if expired or missing.
 */
export async function cacheGet(key: string): Promise<string | null> {
	const database = await getDb();
	const row = await database.getFirstAsync<{ value: string; expiresAt: number }>(
		"SELECT value, expiresAt FROM cache WHERE key = ?",
		[key],
	);

	if (!row) return null;
	if (Date.now() > row.expiresAt) {
		await database.runAsync("DELETE FROM cache WHERE key = ?", [key]);
		return null;
	}

	return row.value;
}

/**
 * Set a cached value with optional TTL in milliseconds.
 */
export async function cacheSet(key: string, value: string, ttl = DEFAULT_TTL): Promise<void> {
	const database = await getDb();
	const expiresAt = Date.now() + ttl;
	await database.runAsync(
		"INSERT OR REPLACE INTO cache (key, value, expiresAt) VALUES (?, ?, ?)",
		[key, value, expiresAt],
	);
}

/**
 * Remove a cached value.
 */
export async function cacheRemove(key: string): Promise<void> {
	const database = await getDb();
	await database.runAsync("DELETE FROM cache WHERE key = ?", [key]);
}

/**
 * Clear all expired entries.
 */
export async function cacheClearExpired(): Promise<void> {
	const database = await getDb();
	await database.runAsync("DELETE FROM cache WHERE expiresAt < ?", [Date.now()]);
}
