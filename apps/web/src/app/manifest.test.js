import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import { config } from "@techstream/quark-config";
import { getSiteMetadata } from "../lib/seo/site-metadata.js";
import manifest from "./manifest.js";

describe("Build-time SEO metadata", () => {
	let savedEnv;

	beforeEach(() => {
		savedEnv = { ...process.env };
		process.env.APP_URL = "https://example.com";
	});

	afterEach(() => {
		for (const key of Object.keys(process.env)) {
			if (!(key in savedEnv)) {
				delete process.env[key];
			}
		}

		for (const [key, value] of Object.entries(savedEnv)) {
			process.env[key] = value;
		}
	});

	test("metadata reads from config.appName", () => {
		const metadata = getSiteMetadata();

		assert.strictEqual(metadata.applicationName, config.appName);
		assert.strictEqual(metadata.title.default, config.appName);
		assert.strictEqual(metadata.openGraph.title, config.appName);
		assert.strictEqual(metadata.twitter.title, config.appName);
	});

	test("metadata reads from config.appDescription", () => {
		const metadata = getSiteMetadata();

		assert.strictEqual(metadata.description, config.appDescription);
		assert.strictEqual(metadata.openGraph.description, config.appDescription);
		assert.strictEqual(metadata.twitter.description, config.appDescription);
	});

	test("layout metadata has canonical and social metadata", () => {
		const metadata = getSiteMetadata();

		assert.ok(metadata.metadataBase);
		assert.strictEqual(metadata.alternates.canonical, "/");
		assert.strictEqual(metadata.openGraph.type, "website");
		assert.strictEqual(metadata.twitter.card, "summary");
	});

	test("manifest reads from config", () => {
		const webManifest = manifest();

		assert.strictEqual(webManifest.name, config.appName);
		assert.strictEqual(webManifest.short_name, config.appName);
		assert.strictEqual(webManifest.description, config.appDescription);
		assert.strictEqual(webManifest.start_url, "/");
		assert.strictEqual(webManifest.display, "standalone");
		assert.ok(webManifest.id);
	});
});
