import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	createSentryAdapter,
	ErrorReporter,
	errorReporter,
} from "./error-reporter.js";

describe("ErrorReporter", () => {
	/** @type {ErrorReporter} */
	let reporter;

	beforeEach(() => {
		reporter = new ErrorReporter();
	});

	describe("default instance", () => {
		it("has console adapter registered by default", () => {
			assert.equal(reporter.adapters.length, 1);
			assert.equal(reporter.adapters[0].name, "console");
		});

		it("global singleton has console adapter", () => {
			const names = errorReporter.adapters.map((a) => a.name);
			assert.ok(names.includes("console"));
		});
	});

	describe("use()", () => {
		it("adds an adapter", () => {
			const adapter = { name: "test", report: () => {} };
			reporter.use(adapter);
			assert.equal(reporter.adapters.length, 2);
			assert.equal(reporter.adapters[1].name, "test");
		});

		it("throws if adapter has no name", () => {
			assert.throws(() => reporter.use({ report: () => {} }), /name/);
		});

		it("throws if adapter has no report function", () => {
			assert.throws(() => reporter.use({ name: "bad" }), /report/);
		});
	});

	describe("report()", () => {
		it("calls all registered adapters", () => {
			const calls = [];
			const adapter1 = {
				name: "a1",
				report: (err, ctx) => calls.push({ adapter: "a1", err, ctx }),
			};
			const adapter2 = {
				name: "a2",
				report: (err, ctx) => calls.push({ adapter: "a2", err, ctx }),
			};

			reporter.use(adapter1);
			reporter.use(adapter2);

			const error = new Error("test error");
			reporter.report(error, { requestId: "123" });

			// console adapter + 2 custom = 3 calls
			assert.equal(calls.length, 2);
			assert.equal(calls[0].adapter, "a1");
			assert.equal(calls[1].adapter, "a2");
			assert.equal(calls[0].err, error);
			assert.equal(calls[0].ctx.requestId, "123");
		});

		it("swallows adapter errors without throwing", () => {
			const failAdapter = {
				name: "fail",
				report: () => {
					throw new Error("adapter crash");
				},
			};
			reporter.use(failAdapter);

			assert.doesNotThrow(() => reporter.report(new Error("test")));
		});
	});

	describe("captureMessage()", () => {
		it("calls adapters that support captureMessage", () => {
			const messages = [];
			const adapter = {
				name: "msg",
				report: () => {},
				captureMessage: (msg, level, ctx) => messages.push({ msg, level, ctx }),
			};
			reporter.use(adapter);

			reporter.captureMessage("hello", "warn", { extra: true });

			assert.equal(messages.length, 1);
			assert.equal(messages[0].msg, "hello");
			assert.equal(messages[0].level, "warn");
			assert.equal(messages[0].ctx.extra, true);
		});

		it("skips adapters without captureMessage", () => {
			const adapter = { name: "no-msg", report: () => {} };
			reporter.use(adapter);

			assert.doesNotThrow(() => reporter.captureMessage("hello"));
		});
	});

	describe("setUser()", () => {
		it("includes user in subsequent reports", () => {
			const reported = [];
			const adapter = {
				name: "user-test",
				report: (_err, ctx) => reported.push(ctx),
			};
			reporter.use(adapter);

			reporter.setUser({ id: "u1", email: "a@b.com" });
			reporter.report(new Error("test"));

			assert.equal(reported.length, 1);
			assert.deepEqual(reported[0].user, { id: "u1", email: "a@b.com" });
		});

		it("forwards user to adapters with setUser", () => {
			let receivedUser = null;
			const adapter = {
				name: "user-fwd",
				report: () => {},
				setUser: (u) => {
					receivedUser = u;
				},
			};
			reporter.use(adapter);

			reporter.setUser({ id: "u2" });
			assert.deepEqual(receivedUser, { id: "u2" });
		});
	});

	describe("addBreadcrumb()", () => {
		it("stores breadcrumbs and attaches them to report context", () => {
			const reported = [];
			const adapter = {
				name: "bc-test",
				report: (_err, ctx) => reported.push(ctx),
			};
			reporter.use(adapter);

			reporter.addBreadcrumb("clicked button", "ui", { buttonId: "submit" });
			reporter.addBreadcrumb("navigated", "navigation");
			reporter.report(new Error("test"));

			assert.equal(reported.length, 1);
			assert.equal(reported[0].breadcrumbs.length, 2);
			assert.equal(reported[0].breadcrumbs[0].message, "clicked button");
			assert.equal(reported[0].breadcrumbs[0].category, "ui");
			assert.deepEqual(reported[0].breadcrumbs[0].data, { buttonId: "submit" });
			assert.equal(reported[0].breadcrumbs[1].message, "navigated");
			assert.equal(reported[0].breadcrumbs[1].category, "navigation");
			assert.ok(reported[0].breadcrumbs[0].timestamp);
		});

		it("circular buffer keeps max 50 breadcrumbs", () => {
			for (let i = 0; i < 60; i++) {
				reporter.addBreadcrumb(`crumb-${i}`, "test");
			}

			const crumbs = reporter.breadcrumbs;
			assert.equal(crumbs.length, 50);
			// First 10 should have been evicted, first remaining is crumb-10
			assert.equal(crumbs[0].message, "crumb-10");
			assert.equal(crumbs[49].message, "crumb-59");
		});

		it("forwards breadcrumbs to adapters that support it", () => {
			const received = [];
			const adapter = {
				name: "bc-fwd",
				report: () => {},
				addBreadcrumb: (msg, cat, data) => received.push({ msg, cat, data }),
			};
			reporter.use(adapter);

			reporter.addBreadcrumb("test", "cat", { key: "val" });

			assert.equal(received.length, 1);
			assert.equal(received[0].msg, "test");
			assert.equal(received[0].cat, "cat");
			assert.deepEqual(received[0].data, { key: "val" });
		});
	});

	describe("custom adapter receives correct data", () => {
		it("passes error and enriched context", () => {
			const reported = [];
			const adapter = {
				name: "custom",
				report: (err, ctx) => reported.push({ err, ctx }),
			};
			reporter.use(adapter);

			reporter.setUser({ id: "u1" });
			reporter.addBreadcrumb("init", "app");

			const error = new Error("custom test");
			reporter.report(error, { route: "/api/test" });

			assert.equal(reported.length, 1);
			assert.equal(reported[0].err, error);
			assert.equal(reported[0].ctx.route, "/api/test");
			assert.deepEqual(reported[0].ctx.user, { id: "u1" });
			assert.equal(reported[0].ctx.breadcrumbs.length, 1);
			assert.equal(reported[0].ctx.breadcrumbs[0].message, "init");
		});
	});

	describe("createSentryAdapter()", () => {
		it("returns a valid adapter shape", () => {
			const adapter = createSentryAdapter();
			assert.equal(adapter.name, "sentry");
			assert.equal(typeof adapter.report, "function");
			assert.equal(typeof adapter.captureMessage, "function");
			assert.equal(typeof adapter.setUser, "function");
			assert.equal(typeof adapter.addBreadcrumb, "function");
		});

		it("can be registered without errors", () => {
			const adapter = createSentryAdapter();
			assert.doesNotThrow(() => reporter.use(adapter));
			assert.doesNotThrow(() => reporter.report(new Error("test")));
		});
	});
});
