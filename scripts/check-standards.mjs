import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const rootsToScan = ["apps", "packages", "scripts"];
const ignoreDirNames = new Set([
	"node_modules",
	".git",
	".next",
	".turbo",
	"coverage",
]);
const jsExtensions = new Set([".js", ".jsx", ".mjs"]);
const tsExtensions = new Set([".ts", ".tsx"]);
const throwNewErrorPattern = /\bthrow new Error\s*\(/;
const consolePattern = /\bconsole\.(?:log|warn|error|info)\s*\(/;

/**
 * Tailwind v4 removed the bare `[--var]` shorthand that v3 accepted. Under v4 a
 * class such as `text-[--navbar-text-muted]` is still a *valid* utility name, so
 * Tailwind emits a rule for it - but the declaration body is the bare token
 * `color: --navbar-text-muted`, which is not a valid CSS value. The browser
 * discards the declaration and the element silently inherits instead.
 *
 * Nothing warns: the build exits 0 and the rule is present in the stylesheet, so
 * the breakage is only visible by rendering both themes and reading computed
 * styles. In light mode `body` sets no colour and the inherited default happens
 * to be black, which reads as "working".
 *
 * The v4 forms are `text-(--navbar-text-muted)` or, when the utility namespace
 * would be ambiguous (e.g. `text-` shared between colour and font-size),
 * `text-[color:var(--navbar-text-muted)]`.
 *
 * The pattern matches the *shape* of the v3 shorthand rather than an
 * enumerated list of utilities. An earlier version listed the colour, border and
 * radius families explicitly, which was a false economy: the same mistake is
 * equally reachable through `w-[--panel-width]`, `leading-[--line-height]` or
 * `p-[--gutter]`, and any list has to be extended every time someone reaches
 * for a family it omits.
 *
 * The `-` immediately before `[` is what separates this from ordinary
 * JavaScript. `rows[--i]` (decrement-then-index) and `obj[key--1]` have no
 * hyphen there and do not match. The one shape that is indistinguishable from a
 * real class is `<ident>-[--ident]`, which would require JavaScript that
 * subtracts from a decrement expression - it does not occur in this codebase.
 */
const tailwindV3VarPattern =
	/(?:^|[\s"'`(])(?:[a-z][a-z0-9-]*:)*[a-z][a-z0-9-]*-\[--[a-zA-Z][a-zA-Z0-9-]*\]/;

const consoleAllowlist = [
	/^packages\/config\/src\/validate-env\.js$/,
	/^packages\/core\/src\/testing\//,
	/^packages\/cli\/src\//,
	/^packages\/cli\/templates\/config\/src\/validate-env\.js$/,
	/^packages\/cli\/templates\/base-project\/packages\/config\/src\/validate-env\.js$/,
	/^packages\/admin\/src\/introspect\.js$/,
	/^packages\/cli\/templates\/admin\/src\/introspect\.js$/,
];

const typeScriptAllowlist = [
	/\/src\/generated\//,
	/^apps\/mobile\//,
	/^packages\/cli\/templates\/mobile\//,
	/^packages\/cli\/templates\/.*\.railway\/railway\.ts$/,
	/^\.railway\/railway\.ts$/,
];

function normalizePath(filePath) {
	return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function isTestFile(relativePath) {
	return /\.test\.[jt]sx?$/.test(relativePath);
}

function isGeneratedPath(relativePath) {
	return typeScriptAllowlist.some((pattern) => pattern.test(relativePath));
}

function isRuntimeAppPath(relativePath) {
	return (
		/^apps\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(relativePath) ||
		/^packages\/cli\/templates\/worker\/src\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		) ||
		/^packages\/cli\/templates\/(?:admin-routes|cms-routes)\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		) ||
		/^packages\/cli\/templates\/base-project\/apps\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		)
	);
}

function isSourceFile(relativePath) {
	return (
		/^apps\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(relativePath) ||
		/^packages\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(relativePath) ||
		/^packages\/cli\/templates\/(?:worker|admin|cms|config|jobs|ui)\/src\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		) ||
		/^packages\/cli\/templates\/(?:admin-routes|cms-routes)\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		) ||
		/^packages\/cli\/templates\/base-project\/apps\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		) ||
		/^packages\/cli\/templates\/base-project\/packages\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		)
	);
}

function isConsoleAllowed(relativePath) {
	return consoleAllowlist.some((pattern) => pattern.test(relativePath));
}

function findMatchingLines(content, pattern) {
	const matches = [];
	for (const [index, line] of content.split("\n").entries()) {
		if (pattern.test(line)) {
			matches.push(index + 1);
		}
	}
	return matches;
}

async function collectFiles(directoryPath) {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (ignoreDirNames.has(entry.name)) {
			continue;
		}

		const entryPath = path.join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await collectFiles(entryPath)));
			continue;
		}

		files.push(entryPath);
	}

	return files;
}

async function main() {
	const allFiles = [];

	for (const relativeRoot of rootsToScan) {
		const absoluteRoot = path.join(rootDir, relativeRoot);
		try {
			allFiles.push(...(await collectFiles(absoluteRoot)));
		} catch (error) {
			if (error.code !== "ENOENT") {
				throw error;
			}
		}
	}

	const violations = [];

	for (const filePath of allFiles) {
		const relativePath = normalizePath(filePath);
		const extension = path.extname(relativePath);

		if (tsExtensions.has(extension) && !isGeneratedPath(relativePath)) {
			violations.push(
				`${relativePath}: TypeScript files are not allowed outside generated code.`,
			);
			continue;
		}

		if (!jsExtensions.has(extension) || isGeneratedPath(relativePath)) {
			continue;
		}

		const content = await readFile(filePath, "utf8");

		if (isRuntimeAppPath(relativePath) && !isTestFile(relativePath)) {
			for (const lineNumber of findMatchingLines(
				content,
				throwNewErrorPattern,
			)) {
				violations.push(
					`${relativePath}:${lineNumber}: Use AppError/ValidationError in app runtime code instead of throw new Error().`,
				);
			}
		}

		if (isSourceFile(relativePath)) {
			for (const lineNumber of findMatchingLines(
				content,
				tailwindV3VarPattern,
			)) {
				violations.push(
					`${relativePath}:${lineNumber}: Tailwind v4 ignores the v3 \`[--var]\` shorthand - the utility is emitted with an invalid value and silently does nothing. Use \`utility-(--var)\`, or \`utility-[color:var(--var)]\` when the namespace is ambiguous.`,
				);
			}
		}

		if (
			isSourceFile(relativePath) &&
			!isTestFile(relativePath) &&
			!isConsoleAllowed(relativePath)
		) {
			for (const lineNumber of findMatchingLines(content, consolePattern)) {
				violations.push(
					`${relativePath}:${lineNumber}: Use createLogger() instead of console.* outside CLI/bootstrap allowlists.`,
				);
			}
		}
	}

	if (violations.length > 0) {
		console.error("Standards check failed:\n");
		for (const violation of violations) {
			console.error(`- ${violation}`);
		}
		process.exit(1);
	}

	console.log("Standards check passed.");
}

await main();
