import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	DEFAULT_DEV_PREFLIGHT_TIMEOUT,
	formatWebPreflightFailure,
	runWebPreflight,
} from "./preflight.js";

describe("web preflight", () => {
	test("validates config before pinging the database", async () => {
		const calls = [];

		const result = await runWebPreflight({
			loadAppConfig() {
				calls.push("config");
			},
			async ping({ timeout }) {
				calls.push(timeout);
				return { status: "ok", latencyMs: 12 };
			},
		});

		assert.deepStrictEqual(calls, ["config", DEFAULT_DEV_PREFLIGHT_TIMEOUT]);
		assert.deepStrictEqual(result, { status: "ok", latencyMs: 12 });
	});

	test("formats an actionable failure message", () => {
		assert.match(
			formatWebPreflightFailure({
				message: "PostgreSQL unreachable at localhost:5432",
			}),
			/Start PostgreSQL or check DATABASE_URL \/ POSTGRES_\*/,
		);
	});
});
