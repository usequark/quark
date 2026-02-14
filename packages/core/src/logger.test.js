import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createLogger, requestLogger } from "../src/logger.js";

/** Helper: captures console output during a callback */
const captureConsole = async (fn) => {
	const output = { log: [], warn: [], error: [] };
	const orig = {
		log: console.log,
		warn: console.warn,
		error: console.error,
	};

	console.log = (...args) => output.log.push(args.join(" "));
	console.warn = (...args) => output.warn.push(args.join(" "));
	console.error = (...args) => output.error.push(args.join(" "));

	try {
		await fn();
	} finally {
		console.log = orig.log;
		console.warn = orig.warn;
		console.error = orig.error;
	}
	return output;
};

describe("Logger", () => {
	let originalNodeEnv;
	let originalLogLevel;

	beforeEach(() => {
		originalNodeEnv = process.env.NODE_ENV;
		originalLogLevel = process.env.LOG_LEVEL;
	});

	afterEach(() => {
		if (originalNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalNodeEnv;
		}
		if (originalLogLevel === undefined) {
			delete process.env.LOG_LEVEL;
		} else {
			process.env.LOG_LEVEL = originalLogLevel;
		}
	});

	test("creates logger with default options", () => {
		const log = createLogger();
		assert.ok(log.debug);
		assert.ok(log.info);
		assert.ok(log.warn);
		assert.ok(log.error);
		assert.ok(log.fatal);
		assert.ok(log.child);
	});

	test("default logger instance exists with name 'quark'", async () => {
		process.env.NODE_ENV = "production";
		const log = createLogger({ name: "quark" });
		const output = await captureConsole(() => {
			log.info("hello");
		});
		const entry = JSON.parse(output.log[0]);
		assert.equal(entry.name, "quark");
	});

	test("log level filtering: debug hidden at info level", async () => {
		process.env.NODE_ENV = "production";
		const log = createLogger({ name: "test", level: "info" });

		const output = await captureConsole(() => {
			log.debug("should be hidden");
			log.info("should be visible");
		});

		assert.equal(output.log.length, 1);
		const entry = JSON.parse(output.log[0]);
		assert.equal(entry.msg, "should be visible");
	});

	test("log level filtering: debug visible at debug level", async () => {
		process.env.NODE_ENV = "production";
		const log = createLogger({ name: "test", level: "debug" });

		const output = await captureConsole(() => {
			log.debug("visible");
		});

		assert.equal(output.log.length, 1);
		const entry = JSON.parse(output.log[0]);
		assert.equal(entry.msg, "visible");
		assert.equal(entry.level, "debug");
	});

	test("respects LOG_LEVEL env var", async () => {
		process.env.NODE_ENV = "production";
		process.env.LOG_LEVEL = "warn";
		const log = createLogger({ name: "test" });

		const output = await captureConsole(() => {
			log.info("hidden");
			log.warn("visible");
		});

		assert.equal(output.log.length, 0);
		assert.equal(output.warn.length, 1);
		const entry = JSON.parse(output.warn[0]);
		assert.equal(entry.msg, "visible");
	});

	test("child logger inherits parent context", async () => {
		process.env.NODE_ENV = "production";
		const parent = createLogger({
			name: "parent",
			level: "info",
			context: { service: "web" },
		});

		const child = parent.child({ requestId: "abc-123" });

		const output = await captureConsole(() => {
			child.info("child message");
		});

		const entry = JSON.parse(output.log[0]);
		assert.equal(entry.name, "parent");
		assert.equal(entry.service, "web");
		assert.equal(entry.requestId, "abc-123");
		assert.equal(entry.msg, "child message");
	});

	test("child logger merges context without mutating parent", async () => {
		process.env.NODE_ENV = "production";
		const parent = createLogger({
			name: "parent",
			level: "info",
			context: { a: 1 },
		});

		parent.child({ b: 2 });

		const output = await captureConsole(() => {
			parent.info("parent only");
		});

		const entry = JSON.parse(output.log[0]);
		assert.equal(entry.a, 1);
		assert.equal(entry.b, undefined);
	});

	test("structured output contains required fields", async () => {
		process.env.NODE_ENV = "production";
		const log = createLogger({ name: "fields-test", level: "debug" });

		const output = await captureConsole(() => {
			log.info("test message", { extra: "data" });
		});

		const entry = JSON.parse(output.log[0]);
		assert.ok(entry.timestamp);
		assert.equal(entry.level, "info");
		assert.equal(entry.name, "fields-test");
		assert.equal(entry.msg, "test message");
		assert.equal(entry.extra, "data");
		// timestamp should be ISO 8601
		assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
	});

	test("error and fatal use console.error", async () => {
		process.env.NODE_ENV = "production";
		const log = createLogger({ name: "test", level: "debug" });

		const output = await captureConsole(() => {
			log.error("err msg");
			log.fatal("fatal msg");
		});

		assert.equal(output.error.length, 2);
		const errEntry = JSON.parse(output.error[0]);
		assert.equal(errEntry.level, "error");
		const fatalEntry = JSON.parse(output.error[1]);
		assert.equal(fatalEntry.level, "fatal");
	});

	test("warn uses console.warn", async () => {
		process.env.NODE_ENV = "production";
		const log = createLogger({ name: "test", level: "debug" });

		const output = await captureConsole(() => {
			log.warn("warn msg");
		});

		assert.equal(output.warn.length, 1);
		const entry = JSON.parse(output.warn[0]);
		assert.equal(entry.level, "warn");
	});

	test("dev mode outputs colorized non-JSON string", async () => {
		delete process.env.NODE_ENV;
		const log = createLogger({ name: "dev-test", level: "debug" });

		const output = await captureConsole(() => {
			log.info("hello dev");
		});

		assert.equal(output.log.length, 1);
		const line = output.log[0];
		// Should NOT be valid JSON in dev mode
		assert.throws(() => JSON.parse(line));
		// Should contain the message and logger name
		assert.ok(line.includes("hello dev"));
		assert.ok(line.includes("dev-test"));
		assert.ok(line.includes("INFO"));
	});

	test("call-site data overrides default context", async () => {
		process.env.NODE_ENV = "production";
		const log = createLogger({
			name: "test",
			level: "info",
			context: { region: "us-east" },
		});

		const output = await captureConsole(() => {
			log.info("override", { region: "eu-west" });
		});

		const entry = JSON.parse(output.log[0]);
		assert.equal(entry.region, "eu-west");
	});
});

describe("requestLogger", () => {
	test("creates child logger with request fields", async () => {
		process.env.NODE_ENV = "production";
		const parent = createLogger({ name: "web", level: "info" });
		const getReqLogger = requestLogger(parent);

		const request = {
			method: "GET",
			url: "/api/users?page=1",
			headers: { "x-request-id": "req-456" },
		};

		const output = await captureConsole(() => {
			const reqLog = getReqLogger(request);
			reqLog.info("handling request");
		});

		// First log is "request started", second is "handling request"
		assert.equal(output.log.length, 2);

		const startEntry = JSON.parse(output.log[0]);
		assert.equal(startEntry.msg, "request started");
		assert.equal(startEntry.requestId, "req-456");
		assert.equal(startEntry.method, "GET");
		assert.equal(startEntry.path, "/api/users");

		const handleEntry = JSON.parse(output.log[1]);
		assert.equal(handleEntry.msg, "handling request");
		assert.equal(handleEntry.requestId, "req-456");
	});

	test("generates requestId when header is missing", async () => {
		process.env.NODE_ENV = "production";
		const parent = createLogger({ name: "web", level: "info" });
		const getReqLogger = requestLogger(parent);

		const request = {
			method: "POST",
			url: "/api/data",
			headers: {},
		};

		const output = await captureConsole(() => {
			getReqLogger(request);
		});

		const entry = JSON.parse(output.log[0]);
		assert.ok(entry.requestId);
		assert.equal(entry.method, "POST");
		assert.equal(entry.path, "/api/data");
	});
});
