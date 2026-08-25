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

const consoleAllowlist = [
	/^packages\/config\/src\/validate-env\.js$/,
	/^packages\/core\/src\/testing\//,
	/^packages\/cli\/src\//,
	/^packages\/cli\/templates\/config\/src\/validate-env\.js$/,
	/^packages\/cli\/templates\/base-project\/packages\/config\/src\/validate-env\.js$/,
];

const typeScriptAllowlist = [/\/src\/generated\//];

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
		/^packages\/cli\/templates\/base-project\/apps\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		)
	);
}

function isSourceFile(relativePath) {
	return (
		/^apps\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(relativePath) ||
		/^packages\/.*\/src\/.*\.(?:js|jsx|mjs)$/.test(relativePath) ||
		/^packages\/cli\/templates\/(?:worker|config|jobs|ui)\/src\/.*\.(?:js|jsx|mjs)$/.test(
			relativePath,
		) ||
		/^packages\/cli\/templates\/base-project\/apps\/.*\.(?:js|jsx|mjs)$/.test(
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
			for (const lineNumber of findMatchingLines(content, throwNewErrorPattern)) {
				violations.push(
					`${relativePath}:${lineNumber}: Use AppError/ValidationError in app runtime code instead of throw new Error().`,
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