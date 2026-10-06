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

			// `*.integration-test.js` renders components through jsdom + react-dom,
			// so it must be collected too. It was previously skipped, which meant
			// those suites never ran in CI - a real gap, not a naming preference:
			// every one of them passed locally but was invisible to the pipeline.
			// Note the file suffix is `-integration-test.js`, so
			// `*.integration.test.js` (a different, separately-excluded name) is
			// still only picked up by the plain `.test.js` rule below.
			if (
				!entry.isFile() ||
				(!entry.name.endsWith(".test.js") &&
					!entry.name.endsWith(".integration-test.js"))
			) {
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
	// An empty suite is not a failure. `node --test` exits 0 when it matches no
	// files, so exiting 1 here made a freshly scaffolded project fail its own
	// `pnpm test` and therefore its pre-push hook.
	console.log(`No test files found in: ${roots.join(", ")} - nothing to run.`);
	process.exit(0);
}

const result = spawnSync(
	process.execPath,
	[
		"--import",
		"tsx/esm",
		"--experimental-test-module-mocks",
		"--test",
		...files,
	],
	{
		stdio: "inherit",
	},
);

process.exit(result.status ?? 1);
