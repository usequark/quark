import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const roots = [];
const excludes = [];

for (const arg of args) {
	if (arg.startsWith("--exclude=")) {
		excludes.push(arg.slice("--exclude=".length));
		continue;
	}

	roots.push(arg);
}

if (roots.length === 0) {
	roots.push("src");
}

function collectTests(targetPath) {
	const stats = [];

	function walk(currentPath) {
		for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
			const fullPath = path.join(currentPath, entry.name);

			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}

			if (!entry.isFile() || !entry.name.endsWith(".test.js")) {
				continue;
			}

			if (excludes.some((exclude) => fullPath.endsWith(exclude))) {
				continue;
			}

			stats.push(fullPath);
		}
	}

	walk(targetPath);
	return stats;
}

const files = roots.flatMap((rootPath) => collectTests(path.resolve(rootPath)));

if (files.length === 0) {
	console.error(`No test files found in: ${roots.join(", ")}`);
	process.exit(1);
}

const result = spawnSync(
	process.execPath,
	["--import", "tsx/esm", "--test", ...files],
	{
		stdio: "inherit",
	},
);

process.exit(result.status ?? 1);
