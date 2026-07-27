/**
 * Umami Database Client
 * Reads analytics data directly from Umami's PostgreSQL database.
 * No API key needed — we connect to the same DB Umami uses.
 */

import { createLogger } from "@techstream/quark-core";

const log = createLogger("lib:umami-db");

let _pool = null;

/**
 * Get or create the Umami DB connection pool.
 * Uses pg module — falls back to a mock if pg is unavailable.
 * @returns {Promise<object>} Pool with query() method
 */
async function getPool() {
	if (_pool) return _pool;

	const connectionString = process.env.UMAMI_DATABASE_URL;

	if (
		connectionString &&
		(connectionString.startsWith("postgresql://") ||
			connectionString.startsWith("postgres://"))
	) {
		// Try to import pg dynamically (it's a dependency of web, but worker may have it via prisma)
		try {
			const { default: pg } = await import("pg");
			_pool = new pg.Pool({ connectionString });
			// Test connection
			const client = await _pool.connect();
			await client.query("SELECT 1");
			client.release();
			log.info("Connected to Umami database");
			return _pool;
		} catch (err) {
			log.warn("Cannot connect to Umami DB directly, using mock", {
				error: err.message,
			});
		}
	}

	// Fallback mock — returns empty data when Umami DB isn't configured
	log.info("Umami DB not configured — analytics will return empty data");
	_pool = {
		query: async () => ({ rows: [] }),
		end: async () => {},
	};
	return _pool;
}

/**
 * Execute a query against Umami's database.
 * @param {string} text - SQL query
 * @param {Array} [params] - Query parameters
 * @returns {Promise<Array>} Result rows
 */
async function query(text, params = []) {
	try {
		const pool = await getPool();
		const result = await pool.query(text, params);
		return result.rows;
	} catch (error) {
		log.error("Umami DB query failed", {
			error: error.message,
			text: text.slice(0, 100),
		});
		return [];
	}
}

/**
 * Get the Umami website ID for a given managed project.
 * @param {string} umamiWebsiteId - The umamiWebsiteId stored on ManagedProject
 * @returns {Promise<string|null>} Umami website UUID
 */
export async function getWebsiteId(umamiWebsiteId) {
	if (!umamiWebsiteId) return null;

	// The umamiWebsiteId on ManagedProject stores the UUID from Umami's website table
	const rows = await query(
		"SELECT website_id FROM website WHERE website_id::text = $1 OR domain = $1 LIMIT 1",
		[umamiWebsiteId],
	);

	return rows.length > 0 ? rows[0].website_id : null;
}

/**
 * Get pageview counts for a website within a date range.
 * @param {string} websiteId - Umami website UUID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {Promise<number>} Pageview count
 */
export async function getPageviews(websiteId, startDate, endDate) {
	const rows = await query(
		`SELECT COUNT(*) as count
     FROM website_event
     WHERE website_id::text = $1
       AND created_at >= $2
       AND created_at <= $3
       AND event_type = 1`,
		[websiteId, startDate, endDate],
	);
	return parseInt(rows[0]?.count || "0", 10);
}

/**
 * Get unique visitor count for a website within a date range.
 * @param {string} websiteId - Umami website UUID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {Promise<number>} Visitor count
 */
export async function getVisitors(websiteId, startDate, endDate) {
	const rows = await query(
		`SELECT COUNT(DISTINCT session_id) as count
     FROM website_event
     WHERE website_id::text = $1
       AND created_at >= $2
       AND created_at <= $3`,
		[websiteId, startDate, endDate],
	);
	return parseInt(rows[0]?.count || "0", 10);
}

/**
 * Get top pages by pageview count for a website.
 * @param {string} websiteId - Umami website UUID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {number} [limit=10] - Max results
 * @returns {Promise<Array>} Top pages with url and count
 */
export async function getTopPages(websiteId, startDate, endDate, limit = 10) {
	return query(
		`SELECT url_path as url, COUNT(*) as count
     FROM website_event
     WHERE website_id::text = $1
       AND created_at >= $2
       AND created_at <= $3
       AND event_type = 1
     GROUP BY url_path
     ORDER BY count DESC
     LIMIT $4`,
		[websiteId, startDate, endDate, limit],
	);
}

/**
 * Get bounce rate for a website within a date range.
 * Bounce rate = sessions with only one event / total sessions.
 * @param {string} websiteId - Umami website UUID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {Promise<number>} Bounce rate percentage (0-100)
 */
export async function getBounceRate(websiteId, startDate, endDate) {
	const rows = await query(
		`WITH session_event_counts AS (
       SELECT session_id, COUNT(*) as event_count
       FROM website_event
       WHERE website_id::text = $1
         AND created_at >= $2
         AND created_at <= $3
       GROUP BY session_id
     )
     SELECT
       COUNT(*) FILTER (WHERE event_count = 1) as bounced_sessions,
       COUNT(*) as total_sessions
     FROM session_event_counts`,
		[websiteId, startDate, endDate],
	);

	const total = parseInt(rows[0]?.total_sessions || "0", 10);
	const bounced = parseInt(rows[0]?.bounced_sessions || "0", 10);

	return total > 0 ? Math.round((bounced / total) * 10000) / 100 : 0;
}

/**
 * Get referrer breakdown for a website.
 * @param {string} websiteId - Umami website UUID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {number} [limit=10] - Max results
 * @returns {Promise<Array>} Referrers with count
 */
export async function getTrafficSources(
	websiteId,
	startDate,
	endDate,
	limit = 10,
) {
	return query(
		`SELECT
       COALESCE(NULLIF(referrer_domain, ''), 'direct') as source,
       COUNT(*) as count
     FROM website_event
     WHERE website_id::text = $1
       AND created_at >= $2
       AND created_at <= $3
       AND event_type = 1
     GROUP BY source
     ORDER BY count DESC
     LIMIT $4`,
		[websiteId, startDate, endDate, limit],
	);
}

/**
 * Get time-series pageview data for charts.
 * @param {string} websiteId - Umami website UUID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {Promise<Array>} Daily pageview counts
 */
export async function getTimeSeries(websiteId, startDate, endDate) {
	return query(
		`SELECT
       DATE(created_at) as date,
       COUNT(*) as pageviews,
       COUNT(DISTINCT session_id) as visitors
     FROM website_event
     WHERE website_id::text = $1
       AND created_at >= $2
       AND created_at <= $3
       AND event_type = 1
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
		[websiteId, startDate, endDate],
	);
}

/**
 * Get all analytics data for a project in one call.
 * @param {string} umamiWebsiteId - Umami website ID from ManagedProject
 * @param {number} [days=30] - Lookback period
 * @returns {Promise<object>} Aggregated analytics data
 */
export async function getProjectAnalytics(umamiWebsiteId, days = 30) {
	if (!umamiWebsiteId) {
		return { error: "No Umami website ID configured" };
	}

	const websiteId = await getWebsiteId(umamiWebsiteId);
	if (!websiteId) {
		return { error: `Umami website "${umamiWebsiteId}" not found` };
	}

	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	const thirtyDaysAgo = startDate;
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

	const [
		pageviews,
		visitors,
		bounceRate,
		topPages,
		trafficSources,
		timeSeries,
		pageviews7d,
		visitors7d,
	] = await Promise.all([
		getPageviews(websiteId, thirtyDaysAgo, endDate),
		getVisitors(websiteId, thirtyDaysAgo, endDate),
		getBounceRate(websiteId, thirtyDaysAgo, endDate),
		getTopPages(websiteId, thirtyDaysAgo, endDate),
		getTrafficSources(websiteId, thirtyDaysAgo, endDate),
		getTimeSeries(websiteId, thirtyDaysAgo, endDate),
		getPageviews(websiteId, sevenDaysAgo, endDate),
		getVisitors(websiteId, sevenDaysAgo, endDate),
	]);

	return {
		websiteId,
		period: { days, startDate: thirtyDaysAgo, endDate },
		summary: {
			pageviews,
			visitors,
			bounceRate,
			avgDailyPageviews: days > 0 ? Math.round(pageviews / days) : 0,
		},
		trends: {
			last7days: { pageviews: pageviews7d, visitors: visitors7d },
			last30days: { pageviews, visitors },
		},
		topPages,
		trafficSources,
		timeSeries,
	};
}
