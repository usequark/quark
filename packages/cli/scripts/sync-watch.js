#!/usr/bin/env node

/**
 * sync-watch.js
 *
 * Watches monorepo source directories for changes and re-runs template sync.
 * Used during development to keep templates in sync automatically.
 *
 * Usage:
 *   node packages/cli/scripts/sync-watch.js
 *
 * Requires: chokidar (already a devDependency via turbo)
 */

import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

// Source directories that feed into templates (from sync-templates.js SYNC_DIRS)
const WATCH_DIRS = [
	"apps/web",
	"apps/worker",
	"apps/mobile",
	"packages/db",
	"packages/config",
	"packages/ui",
	"packages/jobs",
	"packages/admin",
];

// Individual files to watch (from sync-templates.js SYNC_FILES)
const WATCH_FILES = [
	".dockerignore",
	"scripts/dev-preflight.mjs",
	"scripts/clean-workspace.mjs",
	"scripts/run-tests.mjs",
	"turbo.json",
	"docker-compose.yml",
	"docker-compose.override.yml",
	"pnpm-workspace.yaml",
	// Source data for generators
	"package.json",
	"biome.json",
	".gitignore",
];

let syncTimeout = null;
let isSyncing = false;
let syncCount = 0;

function scheduleSync(reason) {
	if (isSyncing) return;

	// Debounce: wait 300ms after last change
	if (syncTimeout) clearTimeout(syncTimeout);
	syncTimeout = setTimeout(async () => {
		isSyncing = true;
		syncCount++;

		const prefix = `\x1b[2m${new Date().toISOString().slice(11, 19)}\x1b[0m`;
		console.log(`${prefix} 🔄 Syncing templates (${reason})...`);

		try {
			const { stdout, stderr } = await execFileAsync(
				"node",
				[path.join(__dirname, "sync-templates.js")],
				{ cwd: ROOT, timeout: 30000 },
			);
			const output = (stdout + stderr).trim();
			if (output.includes("✅")) {
				console.log(`${prefix} ✅ Templates in sync`);
			} else if (output) {
				// Show concise summary
				const lines = output.split("\n");
				const summary = lines.find(
					(l) => l.includes("Synced") || l.includes("drift"),
				);
				if (summary) console.log(`${prefix} ${summary.trim()}`);
			}
		} catch (error) {
			console.error(`${prefix} ❌ Sync failed: ${error.message}`);
		} finally {
			isSyncing = false;
		}
	}, 300);
}

function startWatching() {
	console.log("👀 Watching source directories for changes...\n");
	console.log("  Watching:");
	for (const dir of WATCH_DIRS) {
		console.log(`    ${dir}/`);
	}
	for (const file of WATCH_FILES) {
		console.log(`    ${file}`);
	}
	console.log("\n  Press Ctrl+C to stop.\n");

	// Watch directories recursively
	for (const dir of WATCH_DIRS) {
		const absDir = path.join(ROOT, dir);
		try {
			watch(absDir, { recursive: true }, (eventType, filename) => {
				if (!filename) return;
				// Skip test files, generated code, node_modules
				if (
					filename.includes(".test.") ||
					filename.includes("node_modules") ||
					filename.includes("src/generated") ||
					filename.includes(".next")
				) {
					return;
				}
				scheduleSync(`${dir}/${filename}`);
			});
		} catch {
			// Directory might not exist
		}
	}

	// Watch individual files
	for (const file of WATCH_FILES) {
		const absFile = path.join(ROOT, file);
		try {
			watch(absFile, () => {
				scheduleSync(file);
			});
		} catch {
			// File might not exist
		}
	}
}

startWatching();
