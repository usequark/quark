import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as core from "@usequark/quark-core";
import * as admin from "@usequark/quark-core/admin";
import * as auth from "@usequark/quark-core/auth";
import * as authMiddleware from "@usequark/quark-core/auth/middleware";
import * as coreLight from "@usequark/quark-core/core";
import * as db from "@usequark/quark-core/db";
import * as email from "@usequark/quark-core/email";
import * as errors from "@usequark/quark-core/errors";
import * as locale from "@usequark/quark-core/locale";
import * as logger from "@usequark/quark-core/logger";
import * as metrics from "@usequark/quark-core/metrics";
import * as queue from "@usequark/quark-core/queue";
import * as sms from "@usequark/quark-core/sms";
import * as storage from "@usequark/quark-core/storage";
import * as storageS3 from "@usequark/quark-core/storage/s3";
import * as stripe from "@usequark/quark-core/stripe";
import * as testing from "@usequark/quark-core/testing";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

// Guard against accidental subpath removals: every entry in the exports map
// must resolve. apps/web imports `@usequark/quark-core/logger`, and the
// scaffolded i18n/payment skills document `./locale` and `./stripe`.
test("every subpath in package.json exports resolves", async () => {
	for (const subpath of Object.keys(packageJson.exports)) {
		const specifier = `@usequark/quark-core${
			subpath === "." ? "" : subpath.slice(1)
		}`;
		await assert.doesNotReject(
			() => import(specifier),
			`failed to import ${specifier}`,
		);
	}
});

test("subpath '.' (full barrel) exports all key utilities", () => {
	assert.equal(typeof core.createAuthConfig, "function");
	assert.equal(typeof core.createStorage, "function");
	assert.equal(typeof core.AppError, "function");
	assert.equal(typeof core.createLogger, "function");
	assert.equal(typeof core.createS3Storage, "function");
	assert.equal(typeof core.createPrismaClient, "function");
	assert.equal(typeof core.pingDatabase, "function");
	assert.equal(typeof core.parseSchema, "function");
	assert.equal(typeof core.requireSession, "function");
	assert.equal(typeof core.requireSessionRole, "function");
	assert.equal(typeof core.createAuthMiddleware, "function");
});

test("subpath './core' exports lightweight utilities", () => {
	assert.equal(typeof coreLight.AppError, "function");
	assert.equal(typeof coreLight.ValidationError, "function");
	assert.equal(typeof coreLight.createLogger, "function");
	assert.equal(typeof coreLight.validateBody, "function");
	assert.equal(typeof coreLight.retryAsync, "function");
	assert.equal(typeof coreLight.parsePagination, "function");
	assert.equal(typeof coreLight.generateCsrfToken, "function");
	assert.equal(typeof coreLight.createRateLimiter, "function");
	assert.equal(typeof coreLight.validateFile, "function");
	assert.equal(typeof coreLight.createPrismaClient, "function");
	assert.equal(typeof coreLight.pingDatabase, "function");
	// Should NOT export heavier modules
	assert.equal(coreLight.createStorage, undefined);
	assert.equal(coreLight.createEmailService, undefined);
});

test("subpath './auth' exports config + middleware", () => {
	assert.equal(typeof auth.createAuthConfig, "function");
	assert.equal(typeof auth.requireSession, "function");
	assert.equal(typeof auth.requireSessionRole, "function");
	assert.equal(typeof auth.createAuthMiddleware, "function");
});

test("subpath './auth/middleware' exports middleware only", () => {
	assert.equal(typeof authMiddleware.requireSession, "function");
	assert.equal(typeof authMiddleware.requireSessionRole, "function");
	assert.equal(typeof authMiddleware.createAuthMiddleware, "function");
});

test("subpath './errors' exports error classes", () => {
	assert.equal(typeof errors.AppError, "function");
	assert.equal(typeof errors.ValidationError, "function");
	assert.equal(typeof errors.UnauthorizedError, "function");
	assert.equal(typeof errors.ForbiddenError, "function");
});

test("subpath './logger' exports the browser-safe logger", () => {
	assert.equal(typeof logger.createLogger, "function");
});

test("subpath './locale' exports locale utilities", () => {
	assert.equal(typeof locale.getDefaultLocale, "function");
	assert.equal(typeof locale.getSupportedLocales, "function");
	assert.equal(typeof locale.isLocaleSupported, "function");
});

test("subpath './stripe' exports payment utilities", () => {
	assert.equal(typeof stripe.createStripeClient, "function");
	assert.equal(typeof stripe.getStripeWebhookEvent, "function");
});

test("subpath './storage' exports storage utilities", () => {
	assert.equal(typeof storage.createStorage, "function");
	assert.equal(typeof storage.createLocalStorage, "function");
	assert.equal(typeof storage.createS3Storage, "function");
	assert.equal(typeof storage.generateStorageKey, "function");
	assert.equal(typeof storage.getAssetUrl, "function");
});

test("subpath './storage/s3' exports S3 adapter only", () => {
	assert.equal(typeof storageS3.createS3Storage, "function");
});

test("subpath './db' exports database utilities", () => {
	assert.equal(typeof db.getConnectionString, "function");
	assert.equal(typeof db.getPoolConfig, "function");
	assert.equal(typeof db.createPrismaClient, "function");
	assert.equal(typeof db.pingDatabase, "function");
});

test("subpath './admin' exports introspection utilities", () => {
	assert.equal(typeof admin.parseSchema, "function");
	assert.equal(typeof admin.getModelByName, "function");
	assert.equal(typeof admin.detectIdField, "function");
	assert.equal(typeof admin.coerceId, "function");
	assert.equal(typeof admin.getModels, "function");
	assert.equal(typeof admin.getEnums, "function");
});

test("subpath './queue' exports queue utilities", () => {
	assert.equal(typeof queue.createQueue, "function");
});

test("subpath './email' exports email utilities", () => {
	assert.equal(typeof email.createEmailService, "function");
});

test("subpath './sms' exports SMS utilities", () => {
	assert.equal(typeof sms.createSmsService, "function");
});

test("subpath './metrics' exports metrics utilities", () => {
	assert.equal(typeof metrics.createMetrics, "function");
});

test("subpath './testing' exports test utilities", () => {
	assert.equal(typeof testing.createTestUser, "function");
});
