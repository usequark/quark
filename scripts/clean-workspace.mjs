#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const CHECK_MODE = args.has("--check");
const DEEP_MODE = args.has("--deep");
const SKIP_TASK_CLEAN = args.has("--skip-task-clean");
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_CLEAN_INTERVAL_MS = DAY_MS;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const AUTO_CLEAN_STATE_FILE = ".quark-auto-clean.json";
export const TARGET_DIR_NAMES = new Set([
	".turbo",
	".next",
	"build",
	"coverage",
	"dist",
]);
export const PROTECTED_PREFIXES = ["packages/cli/templates"];
export const DEEP_ONLY_ROOT_DIRS = ["tmp-npm-smoke", "tmp-test-project"];
export const AUTO_CLEAN_POLICIES = {
	coverage: { ageSource: "mtimeMs", minAgeMs: 3 * DAY_MS },
	build: { ageSource: "mtimeMs", minAgeMs: 3 * DAY_MS },
	dist: { ageSource: "mtimeMs", minAgeMs: 3 * DAY_MS },
	"tmp-test-project": { ageSource: "mtimeMs", minAgeMs: 3 * DAY_MS },
	"tmp-npm-smoke": { ageSource: "mtimeMs", minAgeMs: 3 * DAY_MS },
	".next": {
		ageSource: "birthtimeMs",
		minAgeMs: 7 * DAY_MS,
		minSizeBytes: 200 * 1024 * 1024,
	},
	".turbo": {
		ageSource: "birthtimeMs",
		minAgeMs: 7 * DAY_MS,
		minSizeBytes: 1024 * 1024 * 1024,
	},
};

function toPosixPath(value) {
	return value.split(path.sep).join("/");
}

function toRelativePath(targetPath) {
	return toPosixPath(path.relative(ROOT, targetPath));
}

function pathExists(targetPath) {
	return fs.existsSync(targetPath);
}

function isProtectedPath(relativePath) {
	if (!relativePath || relativePath === ".") {
		return false;
	}

	return PROTECTED_PREFIXES.some(
		(prefix) =>
			relativePath === prefix || relativePath.startsWith(`${prefix}/`),
	);
}

function shouldSkipTraversal(entryName, relativePath) {
	if (entryName === ".git" || entryName === "node_modules") {
		return true;
	}

	return (
		DEEP_ONLY_ROOT_DIRS.includes(relativePath) || isProtectedPath(relativePath)
	);
}

function collectTargetPaths(currentDir = ROOT, targets = []) {
	let entries = [];
	try {
		entries = fs.readdirSync(currentDir, { withFileTypes: true });
	} catch {
		return targets;
	}

	for (const entry of entries) {
		if (!entry.isDirectory() || entry.isSymbolicLink()) {
			continue;
		}

		const absolutePath = path.join(currentDir, entry.name);
		const relativePath = toRelativePath(absolutePath);

		if (shouldSkipTraversal(entry.name, relativePath)) {
			continue;
		}

		if (TARGET_DIR_NAMES.has(entry.name)) {
			targets.push(absolutePath);
			continue;
		}

		collectTargetPaths(absolutePath, targets);
	}

	return targets;
}

function getPathSize(targetPath) {
	let stats;
	try {
		stats = fs.lstatSync(targetPath);
	} catch {
		return 0;
	}

	if (stats.isSymbolicLink()) {
		return 0;
	}

	if (stats.isFile()) {
		return stats.size;
	}

	if (!stats.isDirectory()) {
		return 0;
	}

	let total = 0;
	let entries = [];
	try {
		entries = fs.readdirSync(targetPath, { withFileTypes: true });
	} catch {
		return 0;
	}

	for (const entry of entries) {
		total += getPathSize(path.join(targetPath, entry.name));
	}

	return total;
}

function buildTargetDetails(paths) {
	return [...new Set(paths.map((targetPath) => path.resolve(targetPath)))]
		.filter((targetPath) => pathExists(targetPath))
		.map((targetPath) => {
			try {
				const stats = fs.lstatSync(targetPath);

				return {
					birthtimeMs: stats.birthtimeMs,
					mtimeMs: stats.mtimeMs,
					name: path.basename(targetPath),
					path: targetPath,
					relativePath: toRelativePath(targetPath),
					size: getPathSize(targetPath),
				};
			} catch {
				return null;
			}
		})
		.filter(Boolean)
		.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function collectTargets({ includeDeep = false } = {}) {
	const targets = collectTargetPaths();

	if (includeDeep) {
		for (const relativePath of DEEP_ONLY_ROOT_DIRS) {
			const absolutePath = path.join(ROOT, relativePath);
			if (pathExists(absolutePath)) {
				targets.push(absolutePath);
			}
		}
	}

	return buildTargetDetails(targets);
}

function printTargets(label, targets) {
	console.log(label);
	for (const target of targets) {
		console.log(`  ${target.relativePath}\t${humanSize(target.size)}`);
	}
	console.log(`  Total\t${humanSize(sumSizes(targets))}`);
}

export function sumSizes(targets) {
	return targets.reduce((total, target) => total + target.size, 0);
}

export function humanSize(bytes) {
	if (bytes === 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function readRootPackageName() {
	const packageJsonPath = path.join(ROOT, "package.json");
	if (!pathExists(packageJsonPath)) {
		return null;
	}

	try {
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
		return typeof packageJson.name === "string" ? packageJson.name : null;
	} catch {
		return null;
	}
}

function runTaskClean() {
	if (
		CHECK_MODE ||
		SKIP_TASK_CLEAN ||
		!pathExists(path.join(ROOT, "turbo.json"))
	) {
		return;
	}

	const rootPackageName = readRootPackageName();
	const npmExecPath = process.env.npm_execpath;
	const command = npmExecPath
		? process.execPath
		: process.platform === "win32"
			? "pnpm.cmd"
			: "pnpm";
	const commandArgs = npmExecPath
		? [npmExecPath, "exec", "turbo", "run", "clean"]
		: ["exec", "turbo", "run", "clean"];

	if (rootPackageName) {
		commandArgs.push(`--filter=!${rootPackageName}`);
	}

	const result = spawnSync(command, commandArgs, {
		cwd: ROOT,
		stdio: "inherit",
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

export function removeTargets(targets) {
	const removed = [];
	const failed = [];

	for (const target of targets) {
		try {
			fs.rmSync(target.path, {
				force: true,
				maxRetries: 3,
				recursive: true,
				retryDelay: 100,
			});
			removed.push(target);
		} catch (error) {
			failed.push({ ...target, error });
		}
	}

	return { failed, removed };
}

function diffRemovedTargets(beforeTargets, afterTargets) {
	const afterPathSet = new Set(
		afterTargets.map((target) => target.relativePath),
	);
	return beforeTargets.filter(
		(target) => !afterPathSet.has(target.relativePath),
	);
}

function readAutoCleanState() {
	const statePath = path.join(ROOT, AUTO_CLEAN_STATE_FILE);
	if (!pathExists(statePath)) {
		return null;
	}

	try {
		return JSON.parse(fs.readFileSync(statePath, "utf8"));
	} catch {
		return null;
	}
}

function writeAutoCleanState(state) {
	try {
		fs.writeFileSync(
			path.join(ROOT, AUTO_CLEAN_STATE_FILE),
			`${JSON.stringify(state, null, "\t")}\n`,
			"utf8",
		);
		return true;
	} catch {
		return false;
	}
}

function formatAgeDays(ageMs) {
	return `${Math.max(1, Math.floor(ageMs / DAY_MS))}d old`;
}

function formatAutoCleanReason(target) {
	return `${formatAgeDays(target.ageMs)}, ${humanSize(target.size)}`;
}

export function getAutoCleanTargets({ now = Date.now() } = {}) {
	return collectTargets({ includeDeep: true })
		.map((target) => {
			const policy = AUTO_CLEAN_POLICIES[target.name];
			if (!policy) {
				return null;
			}

			const ageSource = policy.ageSource ?? "mtimeMs";
			const sourceValue =
				ageSource === "birthtimeMs" && target.birthtimeMs > 0
					? target.birthtimeMs
					: target.mtimeMs;
			const ageMs = Math.max(0, now - sourceValue);

			if (ageMs < policy.minAgeMs) {
				return null;
			}

			if (policy.minSizeBytes && target.size < policy.minSizeBytes) {
				return null;
			}

			return { ...target, ageMs };
		})
		.filter(Boolean);
}

export function maybeAutoClean({ logger = console, now = Date.now() } = {}) {
	if (process.env.CI === "true") {
		return { reason: "ci", status: "skipped" };
	}

	if (process.env.QUARK_SKIP_AUTO_CLEAN === "1") {
		logger.log("Skipping Quark auto-clean (QUARK_SKIP_AUTO_CLEAN=1)");
		return { reason: "explicit", status: "skipped" };
	}

	const state = readAutoCleanState();
	if (
		state?.lastCheckedAtMs &&
		now - state.lastCheckedAtMs < AUTO_CLEAN_INTERVAL_MS
	) {
		return { status: "throttled" };
	}

	const targets = getAutoCleanTargets({ now });
	const statePayload = {
		lastCheckedAtMs: now,
		lastCleanedAtMs: state?.lastCleanedAtMs ?? null,
	};

	if (targets.length === 0) {
		if (!writeAutoCleanState(statePayload)) {
			logger.warn?.("Quark auto-clean could not update its local state file.");
		}
		return { status: "noop" };
	}

	logger.log("Auto-cleaning stale workspace artifacts...");

	const { failed, removed } = removeTargets(targets);
	if (removed.length > 0) {
		logger.log(
			`Auto-cleaned ${removed.length} path(s) (${humanSize(sumSizes(removed))} freed).`,
		);
		for (const target of removed) {
			logger.log(`  ${target.relativePath} (${formatAutoCleanReason(target)})`);
		}
	}

	if (failed.length > 0) {
		logger.error("Quark auto-clean could not remove:");
		for (const target of failed) {
			logger.error(`  ${target.relativePath}: ${target.error.message}`);
		}
	}

	if (removed.length > 0) {
		statePayload.lastCleanedAtMs = now;
	}

	if (!writeAutoCleanState(statePayload)) {
		logger.warn?.("Quark auto-clean could not update its local state file.");
	}

	return {
		failed,
		removed,
		status: failed.length > 0 ? "partial" : "cleaned",
	};
}

function main() {
	const initialTargets = collectTargets({ includeDeep: DEEP_MODE });

	if (CHECK_MODE) {
		if (initialTargets.length === 0) {
			console.log(
				`No ${DEEP_MODE ? "deep " : ""}cleanup targets found in ${ROOT}.`,
			);
			return;
		}

		printTargets(
			`Cleanup targets${DEEP_MODE ? " (deep)" : ""} in ${ROOT}:`,
			initialTargets,
		);
		return;
	}

	runTaskClean();

	const remainingTargets = collectTargets({ includeDeep: DEEP_MODE });
	if (initialTargets.length === 0 && remainingTargets.length === 0) {
		console.log(
			`No ${DEEP_MODE ? "deep " : ""}cleanup targets found in ${ROOT}.`,
		);
		return;
	}

	const taskCleanedTargets = diffRemovedTargets(
		initialTargets,
		remainingTargets,
	);
	const { failed, removed } = removeTargets(remainingTargets);

	if (taskCleanedTargets.length > 0) {
		console.log(
			`Workspace clean tasks removed ${taskCleanedTargets.length} path(s) totaling ${humanSize(sumSizes(taskCleanedTargets))}.`,
		);
	}

	if (removed.length > 0) {
		console.log(
			`Removed ${removed.length} path(s) totaling ${humanSize(sumSizes(removed))}.`,
		);
		for (const target of removed) {
			console.log(`  ${target.relativePath}`);
		}
	}

	if (failed.length > 0) {
		console.error("Failed to remove:");
		for (const target of failed) {
			console.error(`  ${target.relativePath}: ${target.error.message}`);
		}
		process.exit(1);
	}
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main();
}
