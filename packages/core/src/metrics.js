/**
 * @techstream/quark-core - Metrics Module
 * Lightweight application metrics with zero external dependencies.
 * Supports counters, gauges, and histograms with optional labels.
 * Exports Prometheus-compatible text format.
 */

/**
 * @typedef {"counter" | "gauge" | "histogram"} MetricType
 *
 * @typedef {Object} MetricOptions
 * @property {string} name - Metric name (e.g. "http_requests_total")
 * @property {string} help - Human-readable description
 * @property {string[]} [labelNames] - Allowed label keys
 *
 * @typedef {Object} HistogramOptions
 * @property {string} name
 * @property {string} help
 * @property {string[]} [labelNames]
 * @property {number[]} [buckets] - Histogram bucket boundaries in ascending order
 */

/** Default histogram buckets (in seconds) */
const DEFAULT_BUCKETS = [
	0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

/**
 * Serialises a label object into a Prometheus label string.
 * @param {Record<string, string>} labels
 * @returns {string} e.g. `{method="GET",path="/api/health"}`
 */
const escapeLabel = (v) =>
	String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

const labelsToKey = (labels) => {
	const keys = Object.keys(labels).sort();
	if (keys.length === 0) return "";
	return `{${keys.map((k) => `${k}="${escapeLabel(labels[k])}"`).join(",")}}`;
};

// ─── Counter ──────────────────────────────────────────────────

class Counter {
	/** @param {MetricOptions} opts */
	constructor(opts) {
		this.name = opts.name;
		this.help = opts.help;
		this.labelNames = opts.labelNames || [];
		/** @type {Map<string, number>} */
		this.values = new Map();
	}

	/**
	 * Increment counter.
	 * @param {Record<string, string>} [labels]
	 * @param {number} [value=1]
	 */
	inc(labels = {}, value = 1) {
		if (value < 0) throw new Error("Counter can only be incremented");
		const key = labelsToKey(labels);
		this.values.set(key, (this.values.get(key) || 0) + value);
	}

	/** Reset all values */
	reset() {
		this.values.clear();
	}

	/** @returns {string} Prometheus text */
	serialize() {
		const lines = [
			`# HELP ${this.name} ${this.help}`,
			`# TYPE ${this.name} counter`,
		];
		for (const [key, val] of this.values) {
			lines.push(`${this.name}${key} ${val}`);
		}
		return lines.join("\n");
	}
}

// ─── Gauge ────────────────────────────────────────────────────

class Gauge {
	/** @param {MetricOptions} opts */
	constructor(opts) {
		this.name = opts.name;
		this.help = opts.help;
		this.labelNames = opts.labelNames || [];
		/** @type {Map<string, number>} */
		this.values = new Map();
	}

	/** Set gauge to a specific value */
	set(labels = {}, value = 0) {
		this.values.set(labelsToKey(labels), value);
	}

	/** Increment gauge */
	inc(labels = {}, value = 1) {
		const key = labelsToKey(labels);
		this.values.set(key, (this.values.get(key) || 0) + value);
	}

	/** Decrement gauge */
	dec(labels = {}, value = 1) {
		const key = labelsToKey(labels);
		this.values.set(key, (this.values.get(key) || 0) - value);
	}

	/** Reset all values */
	reset() {
		this.values.clear();
	}

	/** @returns {string} Prometheus text */
	serialize() {
		const lines = [
			`# HELP ${this.name} ${this.help}`,
			`# TYPE ${this.name} gauge`,
		];
		for (const [key, val] of this.values) {
			lines.push(`${this.name}${key} ${val}`);
		}
		return lines.join("\n");
	}
}

// ─── Histogram ────────────────────────────────────────────────

class Histogram {
	/** @param {HistogramOptions} opts */
	constructor(opts) {
		this.name = opts.name;
		this.help = opts.help;
		this.labelNames = opts.labelNames || [];
		this.buckets = opts.buckets || DEFAULT_BUCKETS;
		/** @type {Map<string, { buckets: number[], sum: number, count: number }>} */
		this.values = new Map();
	}

	/** @private */
	_getOrCreate(key) {
		if (!this.values.has(key)) {
			this.values.set(key, {
				buckets: new Array(this.buckets.length).fill(0),
				sum: 0,
				count: 0,
			});
		}
		return this.values.get(key);
	}

	/**
	 * Observe a value (e.g. request duration in seconds).
	 * @param {Record<string, string>} [labels]
	 * @param {number} value
	 */
	observe(labels = {}, value) {
		const key = labelsToKey(labels);
		const data = this._getOrCreate(key);
		data.sum += value;
		data.count += 1;
		for (let i = 0; i < this.buckets.length; i++) {
			if (value <= this.buckets[i]) {
				data.buckets[i] += 1;
			}
		}
	}

	/**
	 * Returns a timer function. Call the returned function to record
	 * elapsed time in seconds.
	 * @param {Record<string, string>} [labels]
	 * @returns {() => number} stop function — returns elapsed seconds
	 */
	startTimer(labels = {}) {
		const start = performance.now();
		return () => {
			const elapsed = (performance.now() - start) / 1000;
			this.observe(labels, elapsed);
			return elapsed;
		};
	}

	/** Reset all values */
	reset() {
		this.values.clear();
	}

	/** @returns {string} Prometheus text */
	serialize() {
		const lines = [
			`# HELP ${this.name} ${this.help}`,
			`# TYPE ${this.name} histogram`,
		];
		for (const [key, data] of this.values) {
			// Parse existing labels for bucket lines
			const lblPrefix = key ? `${key.slice(0, -1)},` : "{";
			const lblSuffix = key ? "}" : "}";

			for (let i = 0; i < this.buckets.length; i++) {
				const le = this.buckets[i];
				lines.push(
					`${this.name}_bucket${lblPrefix}le="${le}"${lblSuffix} ${data.buckets[i]}`,
				);
			}
			lines.push(
				`${this.name}_bucket${lblPrefix}le="+Inf"${lblSuffix} ${data.count}`,
			);
			lines.push(`${this.name}_sum${key} ${data.sum}`);
			lines.push(`${this.name}_count${key} ${data.count}`);
		}
		return lines.join("\n");
	}
}

// ─── Registry ─────────────────────────────────────────────────

/**
 * A metrics registry that holds all metric instances
 * and can serialize them to Prometheus exposition format.
 */
class MetricsRegistry {
	constructor() {
		/** @type {Map<string, Counter | Gauge | Histogram>} */
		this.metrics = new Map();
	}

	/**
	 * Create and register a counter.
	 * @param {MetricOptions} opts
	 * @returns {Counter}
	 */
	counter(opts) {
		if (this.metrics.has(opts.name)) {
			return /** @type {Counter} */ (this.metrics.get(opts.name));
		}
		const c = new Counter(opts);
		this.metrics.set(opts.name, c);
		return c;
	}

	/**
	 * Create and register a gauge.
	 * @param {MetricOptions} opts
	 * @returns {Gauge}
	 */
	gauge(opts) {
		if (this.metrics.has(opts.name)) {
			return /** @type {Gauge} */ (this.metrics.get(opts.name));
		}
		const g = new Gauge(opts);
		this.metrics.set(opts.name, g);
		return g;
	}

	/**
	 * Create and register a histogram.
	 * @param {HistogramOptions} opts
	 * @returns {Histogram}
	 */
	histogram(opts) {
		if (this.metrics.has(opts.name)) {
			return /** @type {Histogram} */ (this.metrics.get(opts.name));
		}
		const h = new Histogram(opts);
		this.metrics.set(opts.name, h);
		return h;
	}

	/**
	 * Get a registered metric by name.
	 * @param {string} name
	 * @returns {Counter | Gauge | Histogram | undefined}
	 */
	get(name) {
		return this.metrics.get(name);
	}

	/** Reset all metrics */
	resetAll() {
		for (const m of this.metrics.values()) {
			m.reset();
		}
	}

	/**
	 * Serialize all metrics to Prometheus exposition format.
	 * @returns {string}
	 */
	serialize() {
		const blocks = [];
		for (const metric of this.metrics.values()) {
			blocks.push(metric.serialize());
		}
		return `${blocks.join("\n\n")}\n`;
	}

	/** Number of registered metrics */
	get size() {
		return this.metrics.size;
	}
}

// ─── Default Instance & Factory ───────────────────────────────

/**
 * Creates a new metrics registry.
 * @returns {MetricsRegistry}
 */
export const createMetrics = () => new MetricsRegistry();

/**
 * Default application-wide metrics registry.
 * Register HTTP metrics, business metrics, etc. on this instance.
 */
export const metrics = createMetrics();

// ─── Pre-registered HTTP metrics ──────────────────────────────

/** Total HTTP requests (labels: method, path, status) */
export const httpRequestsTotal = metrics.counter({
	name: "http_requests_total",
	help: "Total number of HTTP requests",
	labelNames: ["method", "path", "status"],
});

/** HTTP request duration in seconds (labels: method, path) */
export const httpRequestDuration = metrics.histogram({
	name: "http_request_duration_seconds",
	help: "HTTP request duration in seconds",
	labelNames: ["method", "path"],
});

/** Currently in-flight HTTP requests */
export const httpRequestsInFlight = metrics.gauge({
	name: "http_requests_in_flight",
	help: "Number of HTTP requests currently being processed",
	labelNames: ["method"],
});

/** Total application errors (labels: type) */
export const appErrorsTotal = metrics.counter({
	name: "app_errors_total",
	help: "Total number of application errors",
	labelNames: ["type"],
});

// Re-export classes for advanced usage
export { Counter, Gauge, Histogram, MetricsRegistry };
