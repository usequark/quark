import assert from "node:assert";
import { describe, test } from "node:test";
import {
	appErrorsTotal,
	Counter,
	createMetrics,
	Gauge,
	Histogram,
	httpRequestDuration,
	httpRequestsInFlight,
	httpRequestsTotal,
	MetricsRegistry,
	metrics,
} from "./metrics.js";

describe("Metrics - Counter", () => {
	test("increments by 1 by default", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "test_counter",
			help: "A test counter",
		});

		counter.inc();
		counter.inc();
		counter.inc();

		const output = counter.serialize();
		assert.ok(output.includes("test_counter 3"));
	});

	test("increments by custom value", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "test_counter_custom",
			help: "A test counter",
		});

		counter.inc({}, 5);
		counter.inc({}, 3);

		const output = counter.serialize();
		assert.ok(output.includes("test_counter_custom 8"));
	});

	test("supports labels", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "labeled_counter",
			help: "Counter with labels",
			labelNames: ["method", "status"],
		});

		counter.inc({ method: "GET", status: "200" });
		counter.inc({ method: "POST", status: "201" });
		counter.inc({ method: "GET", status: "200" }, 2);

		const output = counter.serialize();
		assert.ok(output.includes('{method="GET",status="200"} 3'));
		assert.ok(output.includes('{method="POST",status="201"} 1'));
	});

	test("throws on negative increment", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "no_neg",
			help: "No negatives",
		});

		assert.throws(() => counter.inc({}, -1), /can only be incremented/);
	});

	test("reset clears all values", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "reset_counter",
			help: "Resettable",
		});

		counter.inc();
		counter.inc();
		counter.reset();

		assert.strictEqual(counter.values.size, 0);
	});

	test("serializes with HELP and TYPE headers", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "http_total",
			help: "Total requests",
		});

		counter.inc();
		const output = counter.serialize();

		assert.ok(output.includes("# HELP http_total Total requests"));
		assert.ok(output.includes("# TYPE http_total counter"));
	});

	test("escapes special characters in label values", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "escaped_counter",
			help: "Escaping test",
			labelNames: ["path"],
		});

		counter.inc({ path: '/api/"test"' });
		const output = counter.serialize();
		assert.ok(output.includes('path="/api/\\"test\\""'));
	});

	test("escapes backslashes and newlines in label values", () => {
		const registry = createMetrics();
		const counter = registry.counter({
			name: "escape_bs",
			help: "Backslash test",
			labelNames: ["msg"],
		});

		counter.inc({ msg: "line1\nline2" });
		const output = counter.serialize();
		assert.ok(output.includes('msg="line1\\nline2"'));
	});
});

describe("Metrics - Gauge", () => {
	test("set sets a specific value", () => {
		const registry = createMetrics();
		const gauge = registry.gauge({
			name: "test_gauge",
			help: "A test gauge",
		});

		gauge.set({}, 42);

		const output = gauge.serialize();
		assert.ok(output.includes("test_gauge 42"));
	});

	test("inc and dec adjust value", () => {
		const registry = createMetrics();
		const gauge = registry.gauge({
			name: "in_flight",
			help: "In-flight requests",
		});

		gauge.inc();
		gauge.inc();
		gauge.dec();

		const output = gauge.serialize();
		assert.ok(output.includes("in_flight 1"));
	});

	test("supports labels", () => {
		const registry = createMetrics();
		const gauge = registry.gauge({
			name: "labeled_gauge",
			help: "Gauge with labels",
			labelNames: ["method"],
		});

		gauge.set({ method: "GET" }, 10);
		gauge.set({ method: "POST" }, 5);

		const output = gauge.serialize();
		assert.ok(output.includes('{method="GET"} 10'));
		assert.ok(output.includes('{method="POST"} 5'));
	});

	test("reset clears all values", () => {
		const registry = createMetrics();
		const gauge = registry.gauge({
			name: "reset_gauge",
			help: "Resettable",
		});

		gauge.set({}, 100);
		gauge.reset();

		assert.strictEqual(gauge.values.size, 0);
	});
});

describe("Metrics - Histogram", () => {
	test("observe records values into buckets", () => {
		const registry = createMetrics();
		const hist = registry.histogram({
			name: "request_duration",
			help: "Duration of requests",
			buckets: [0.01, 0.05, 0.1, 0.5, 1],
		});

		hist.observe({}, 0.03); // fits in 0.05, 0.1, 0.5, 1
		hist.observe({}, 0.08); // fits in 0.1, 0.5, 1
		hist.observe({}, 0.5); // fits in 0.5, 1

		const output = hist.serialize();
		assert.ok(output.includes('le="0.01"} 0'));
		assert.ok(output.includes('le="0.05"} 1'));
		assert.ok(output.includes('le="0.1"} 2'));
		assert.ok(output.includes('le="0.5"} 3'));
		assert.ok(output.includes('le="1"} 3'));
		assert.ok(output.includes('le="+Inf"} 3'));
		assert.ok(output.includes("_count 3"));
	});

	test("startTimer records elapsed time", async () => {
		const registry = createMetrics();
		const hist = registry.histogram({
			name: "timer_test",
			help: "Timer test",
			buckets: [0.001, 0.01, 0.1, 1, 10],
		});

		const stop = hist.startTimer({ path: "/test" });
		// Small delay to ensure measurable time
		await new Promise((resolve) => setTimeout(resolve, 5));
		const elapsed = stop();

		assert.ok(elapsed > 0, "Elapsed time should be positive");
		assert.ok(elapsed < 1, "Elapsed time should be less than 1 second");

		const output = hist.serialize();
		assert.ok(output.includes("timer_test_count"));
		assert.ok(output.includes("timer_test_sum"));
	});

	test("supports labels on histogram", () => {
		const registry = createMetrics();
		const hist = registry.histogram({
			name: "labeled_hist",
			help: "Labeled histogram",
			labelNames: ["method"],
			buckets: [0.1, 1],
		});

		hist.observe({ method: "GET" }, 0.05);
		hist.observe({ method: "POST" }, 0.5);

		const output = hist.serialize();
		assert.ok(output.includes('method="GET"'));
		assert.ok(output.includes('method="POST"'));
	});

	test("uses default buckets when none provided", () => {
		const registry = createMetrics();
		const hist = registry.histogram({
			name: "default_buckets",
			help: "Default buckets test",
		});

		hist.observe({}, 0.05);
		const output = hist.serialize();

		// Default buckets include 0.005, 0.01, 0.025, 0.05, etc.
		assert.ok(output.includes('le="0.005"'));
		assert.ok(output.includes('le="10"'));
	});
});

describe("Metrics - Registry", () => {
	test("createMetrics returns a new registry", () => {
		const registry = createMetrics();
		assert.ok(registry instanceof MetricsRegistry);
		assert.strictEqual(registry.size, 0);
	});

	test("registers and retrieves metrics", () => {
		const registry = createMetrics();
		const counter = registry.counter({ name: "my_counter", help: "test" });
		const gauge = registry.gauge({ name: "my_gauge", help: "test" });
		const hist = registry.histogram({ name: "my_hist", help: "test" });

		assert.strictEqual(registry.size, 3);
		assert.strictEqual(registry.get("my_counter"), counter);
		assert.strictEqual(registry.get("my_gauge"), gauge);
		assert.strictEqual(registry.get("my_hist"), hist);
	});

	test("returns existing metric if name already registered", () => {
		const registry = createMetrics();
		const first = registry.counter({ name: "dup", help: "first" });
		const second = registry.counter({ name: "dup", help: "second" });

		assert.strictEqual(first, second);
		assert.strictEqual(registry.size, 1);
	});

	test("serialize outputs all metrics in Prometheus format", () => {
		const registry = createMetrics();
		const counter = registry.counter({ name: "req_total", help: "Total reqs" });
		const gauge = registry.gauge({ name: "active", help: "Active conns" });

		counter.inc({}, 10);
		gauge.set({}, 5);

		const output = registry.serialize();
		assert.ok(output.includes("# HELP req_total Total reqs"));
		assert.ok(output.includes("# TYPE req_total counter"));
		assert.ok(output.includes("req_total 10"));
		assert.ok(output.includes("# HELP active Active conns"));
		assert.ok(output.includes("# TYPE active gauge"));
		assert.ok(output.includes("active 5"));
	});

	test("resetAll clears all metric values", () => {
		const registry = createMetrics();
		const counter = registry.counter({ name: "c", help: "test" });
		const gauge = registry.gauge({ name: "g", help: "test" });

		counter.inc({}, 5);
		gauge.set({}, 10);
		registry.resetAll();

		const output = registry.serialize();
		assert.ok(!output.includes("c 5"));
		assert.ok(!output.includes("g 10"));
	});

	test("get returns undefined for unknown metric", () => {
		const registry = createMetrics();
		assert.strictEqual(registry.get("nonexistent"), undefined);
	});
});

describe("Metrics - Default instance", () => {
	test("default metrics registry exists", () => {
		assert.ok(metrics instanceof MetricsRegistry);
	});

	test("pre-registered HTTP metrics exist", () => {
		assert.ok(httpRequestsTotal instanceof Counter);
		assert.ok(httpRequestDuration instanceof Histogram);
		assert.ok(httpRequestsInFlight instanceof Gauge);
		assert.ok(appErrorsTotal instanceof Counter);
	});

	test("pre-registered metrics are in the default registry", () => {
		assert.strictEqual(metrics.get("http_requests_total"), httpRequestsTotal);
		assert.strictEqual(
			metrics.get("http_request_duration_seconds"),
			httpRequestDuration,
		);
		assert.strictEqual(
			metrics.get("http_requests_in_flight"),
			httpRequestsInFlight,
		);
		assert.strictEqual(metrics.get("app_errors_total"), appErrorsTotal);
	});
});
