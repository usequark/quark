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

/**
 * Escapes glob metacharacters so `node --test` treats the path as a literal
 * path rather than a pattern.
 *
 * Next.js dynamic route segments are directories of the form `[id]` and
 * `[...slug]`, and `node --test` matches its file arguments as globs. An
 * unescaped `[id]` is read as a character class matching a single `i` or `d`,
 * so the path matches nothing. The failure is silent — the runner reports
 * zero tests and exits 0 — which meant every test co-located in a dynamic
 * segment (`api/files/[id]/route.test.js`, and `users/[id]` and
 * `[...nextauth]` which have none) was collected here and then silently
 * dropped at the `node --test` boundary.
 *
 * Only `[` and `]` need escaping: a literal `*`, `?`, `{`, `}`, `+`, `@` or
 * `!` in a directory name is resolved as itself once no glob metacharacter
 * remains to give it meaning. `[[]` and `[]]` are the character-class escapes
 * for the literal characters; a backslash is *not* honoured here, so it
 * silently fails to escape anything.
 *
 * @param {string} filePath
 * @returns {string}
 */
function escapeGlobChars(filePath) {
	// Single pass. Two `replaceAll` calls in sequence do not work: the `[` of
	// `[[]` introduces a `]` that the second call then escapes again, yielding
	// `[[[]]` for one literal `[`.
	return filePath.replace(/[[\]]/g, (char) => (char === "[" ? "[[]" : "[]]"));
}

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
		...files.map(escapeGlobChars),
	],
	{
		stdio: "inherit",
	},
);

process.exit(result.status ?? 1);
