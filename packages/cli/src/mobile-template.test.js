import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const TEMPLATES_DIR = join(import.meta.dirname, "../templates");

// ---------------------------------------------------------------------------
// Mobile template structure
// ---------------------------------------------------------------------------

test("mobile template has required files", () => {
	const requiredFiles = [
		"app.json",
		"package.json",
		"tsconfig.json",
		"eas.json",
		"lib/config.ts",
		"lib/auth.ts",
		"lib/api.ts",
		"lib/api-client.ts",
		"lib/notifications.ts",
		"lib/storage.ts",
		"hooks/use-auth.ts",
		"app/_layout.tsx",
		"app/(auth)/sign-in.tsx",
		"app/(auth)/sign-up.tsx",
		"app/(app)/index.tsx",
		"app/(app)/profile.tsx",
	];

	for (const file of requiredFiles) {
		const path = join(TEMPLATES_DIR, "mobile", file);
		assert.ok(
			readFileSync(path, "utf-8").length > 0,
			`mobile template missing or empty: ${file}`,
		);
	}
});

// ---------------------------------------------------------------------------
// Package.json transforms
// ---------------------------------------------------------------------------

test("mobile package.json uses @myquark scope", () => {
	const pkg = JSON.parse(
		readFileSync(join(TEMPLATES_DIR, "mobile/package.json"), "utf-8"),
	);
	assert.strictEqual(pkg.name, "@myquark/mobile");
});

test("mobile package.json includes expo-constants", () => {
	const pkg = JSON.parse(
		readFileSync(join(TEMPLATES_DIR, "mobile/package.json"), "utf-8"),
	);
	assert.ok(
		pkg.dependencies?.["expo-constants"],
		"mobile package.json missing expo-constants dependency",
	);
});

test("mobile package.json has no monorepo workspace refs in devDependencies", () => {
	const pkg = JSON.parse(
		readFileSync(join(TEMPLATES_DIR, "mobile/package.json"), "utf-8"),
	);
	if (pkg.devDependencies) {
		for (const dep of Object.keys(pkg.devDependencies)) {
			assert.ok(
				!dep.startsWith("@techstream/quark-"),
				`mobile devDependencies has monorepo ref: ${dep}`,
			);
		}
	}
});

// ---------------------------------------------------------------------------
// App.json transforms
// ---------------------------------------------------------------------------

test("mobile app.json has runtimeVersion for OTA updates", () => {
	const appJson = JSON.parse(
		readFileSync(join(TEMPLATES_DIR, "mobile/app.json"), "utf-8"),
	);
	assert.deepStrictEqual(appJson.expo.runtimeVersion, {
		policy: "appVersion",
	});
});

test("mobile app.json has __QUARK_PROJECT_NAME__ placeholder in slug", () => {
	const content = readFileSync(join(TEMPLATES_DIR, "mobile/app.json"), "utf-8");
	assert.ok(
		content.includes("__QUARK_PROJECT_NAME__"),
		"app.json should contain __QUARK_PROJECT_NAME__ placeholder",
	);
});

test("mobile app.json has __QUARK_EAS_PROJECT_ID__ placeholder", () => {
	const content = readFileSync(join(TEMPLATES_DIR, "mobile/app.json"), "utf-8");
	assert.ok(
		content.includes("__QUARK_EAS_PROJECT_ID__"),
		"app.json should contain __QUARK_EAS_PROJECT_ID__ placeholder",
	);
});

// ---------------------------------------------------------------------------
// Source code uses lazy config (not module-scope throw)
// ---------------------------------------------------------------------------

test("mobile config.ts uses lazy getConfig() pattern", () => {
	const content = readFileSync(
		join(TEMPLATES_DIR, "mobile/lib/config.ts"),
		"utf-8",
	);
	// Should export a getConfig function (lazy — not a module-scope constant)
	assert.ok(
		content.includes("export function getConfig"),
		"config.ts should export getConfig()",
	);
	// Should NOT have a top-level API_URL constant (the old broken pattern)
	assert.ok(
		!content.includes("const API_URL"),
		"config.ts should not use top-level const API_URL — use lazy getConfig()",
	);
});

// ---------------------------------------------------------------------------
// Notifications use dynamic imports and shouldShowBanner
// ---------------------------------------------------------------------------

test("mobile notifications.ts uses dynamic imports", () => {
	const content = readFileSync(
		join(TEMPLATES_DIR, "mobile/lib/notifications.ts"),
		"utf-8",
	);
	assert.ok(
		content.includes('await import("expo-notifications")'),
		"notifications.ts should use dynamic import for expo-notifications",
	);
	assert.ok(
		content.includes('await import("expo-device")'),
		"notifications.ts should use dynamic import for expo-device",
	);
});

test("mobile notifications.ts uses shouldShowBanner/shouldShowList", () => {
	const content = readFileSync(
		join(TEMPLATES_DIR, "mobile/lib/notifications.ts"),
		"utf-8",
	);
	assert.ok(
		content.includes("shouldShowBanner"),
		"notifications.ts should use shouldShowBanner",
	);
	assert.ok(
		content.includes("shouldShowList"),
		"notifications.ts should use shouldShowList",
	);
	assert.ok(
		!content.includes("shouldShowAlert"),
		"notifications.ts should not use deprecated shouldShowAlert",
	);
});

// ---------------------------------------------------------------------------
// Auth screens use TS-strict-safe error handling
// ---------------------------------------------------------------------------

test("mobile sign-in.tsx uses safe error handling", () => {
	const content = readFileSync(
		join(TEMPLATES_DIR, "mobile/app/(auth)/sign-in.tsx"),
		"utf-8",
	);
	assert.ok(
		content.includes("error instanceof Error"),
		"sign-in.tsx should use instanceof check for error handling",
	);
});

test("mobile sign-up.tsx uses safe error handling", () => {
	const content = readFileSync(
		join(TEMPLATES_DIR, "mobile/app/(auth)/sign-up.tsx"),
		"utf-8",
	);
	assert.ok(
		content.includes("error instanceof Error"),
		"sign-up.tsx should use instanceof check for error handling",
	);
});

// ---------------------------------------------------------------------------
// use-auth uses lazy notification imports
// ---------------------------------------------------------------------------

test("mobile use-auth.ts uses lazy notification imports", () => {
	const content = readFileSync(
		join(TEMPLATES_DIR, "mobile/hooks/use-auth.ts"),
		"utf-8",
	);
	assert.ok(
		content.includes('import("../lib/notifications")'),
		"use-auth.ts should use dynamic import for notifications",
	);
});

// ---------------------------------------------------------------------------
// No placeholder leaks — all __QUARK_ placeholders are in expected files
// ---------------------------------------------------------------------------

test("mobile template has no stray __QUARK_ placeholders in source files", () => {
	const sourceFiles = [
		"lib/config.ts",
		"lib/auth.ts",
		"lib/api.ts",
		"lib/api-client.ts",
		"lib/notifications.ts",
		"lib/storage.ts",
		"hooks/use-auth.ts",
		"app/_layout.tsx",
		"app/(auth)/sign-in.tsx",
		"app/(auth)/sign-up.tsx",
		"app/(app)/index.tsx",
		"app/(app)/profile.tsx",
	];

	for (const file of sourceFiles) {
		const content = readFileSync(join(TEMPLATES_DIR, "mobile", file), "utf-8");
		assert.ok(
			!content.includes("__QUARK_"),
			`${file} contains unreplaced __QUARK_ placeholder`,
		);
	}
});
