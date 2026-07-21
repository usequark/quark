import { getConnectionString } from "./connection.js";

/**
 * Pings PostgreSQL to verify connectivity.
 * Uses a raw `pg.Client` directly so the check is immune to Prisma
 * adapter quirks - in particular, Prisma 7 + @prisma/adapter-pg surfaces
 * connection failures as a misleading "Invalid invocation" error rather
 * than a proper ECONNREFUSED.
 *
 * @param {object} [options]
 * @param {number} [options.timeout=3000] - Connection/query timeout in milliseconds.
 * @returns {Promise<{ status: "ok", latencyMs: number } | { status: "error", message: string }>}
 */
export async function pingDatabase({ timeout = 3000 } = {}) {
	/** @type {import("pg").Client | null} */
	let client = null;
	let connectionString;

	try {
		const { default: pg } = await import("pg");
		connectionString = getConnectionString();

		client = new pg.Client({
			connectionString,
			connectionTimeoutMillis: timeout,
			query_timeout: timeout,
		});

		await client.connect();

		const start = performance.now();
		await client.query("SELECT 1");
		const latencyMs = Math.round(performance.now() - start);

		return { status: "ok", latencyMs };
	} catch (/** @type {any} */ error) {
		let message;
		if (
			error?.code === "MODULE_NOT_FOUND" ||
			error?.code === "ERR_MODULE_NOT_FOUND"
		) {
			message = "pg is not installed";
		} else if (
			error?.code === "ECONNREFUSED" ||
			/ECONNREFUSED/i.test(error?.message ?? "")
		) {
			try {
				const { hostname, port } = new URL(connectionString);
				message = `PostgreSQL unreachable at ${hostname}:${port || "5432"}`;
			} catch {
				message = "PostgreSQL unreachable";
			}
		} else if (error?.code === "ENOTFOUND") {
			message = `PostgreSQL host not found: ${error.hostname ?? "unknown"}`;
		} else {
			message = error?.message ?? String(error);
		}
		return { status: "error", message };
	} finally {
		try {
			await client?.end();
		} catch {
			// ignore disconnect errors
		}
	}
}
