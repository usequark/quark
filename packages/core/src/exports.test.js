import assert from "node:assert/strict";
import test from "node:test";

import * as core from "@techstream/quark-core";
import * as auth from "@techstream/quark-core/auth";
import * as errors from "@techstream/quark-core/errors";
import * as logger from "@techstream/quark-core/logger";
import * as storage from "@techstream/quark-core/storage";
import * as testing from "@techstream/quark-core/testing";

test("published subpath exports resolve through package self-imports", () => {
	assert.equal(typeof core.createAuthConfig, "function");
	assert.equal(typeof auth.createAuthConfig, "function");
	assert.equal(typeof auth.requireAuth, "function");
	assert.equal(typeof errors.AppError, "function");
	assert.equal(typeof errors.ValidationError, "function");
	assert.equal(typeof logger.createLogger, "function");
	assert.equal(typeof storage.createStorage, "function");
	assert.equal(typeof storage.getAssetUrl, "function");
	assert.equal(typeof testing.createTestUser, "function");
});
