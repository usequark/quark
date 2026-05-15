import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	AUTH_PROVIDER_LOAD_ERROR,
	loadAuthProviders,
} from "./provider-loading.js";

describe("loadAuthProviders", () => {
	test("returns providers when the request succeeds", async () => {
		const result = await loadAuthProviders(async () => ({
			ok: true,
			json: async () => ({ github: { id: "github" } }),
		}));

		assert.deepEqual(result, {
			providers: { github: { id: "github" } },
			error: "",
		});
	});

	test("returns a fallback error when the request fails", async () => {
		const result = await loadAuthProviders(async () => ({
			ok: false,
			json: async () => ({}),
		}));

		assert.deepEqual(result, {
			providers: null,
			error: AUTH_PROVIDER_LOAD_ERROR,
		});
	});

	test("returns a fallback error when the request throws", async () => {
		const result = await loadAuthProviders(async () => {
			throw new Error("network down");
		});

		assert.deepEqual(result, {
			providers: null,
			error: AUTH_PROVIDER_LOAD_ERROR,
		});
	});
});
