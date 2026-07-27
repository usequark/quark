/**
 * @techstream/quark-core — Database Metrics Registry
 *
 * Pre-registered Prometheus metrics for database query instrumentation.
 * Imported lazily by db-instrumentation.js to avoid circular dependencies.
 *
 * These metrics are registered on the global `metrics` singleton so they
 * appear alongside HTTP and queue metrics at the /api/metrics endpoint.
 */

import { metrics } from "./metrics.js";

/** Total database queries (labels: model, operation) */
export const dbQueriesTotal = metrics.counter({
	name: "db_queries_total",
	help: "Total number of database queries executed",
	labelNames: ["model", "operation"],
});

/** Database query duration in seconds (labels: model, operation) */
export const dbQueryDuration = metrics.histogram({
	name: "db_query_duration_seconds",
	help: "Database query duration in seconds",
	labelNames: ["model", "operation"],
	buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
