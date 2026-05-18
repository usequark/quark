import { spawnSync } from "node:child_process";
import path from "node:path";

const SCOPE_PATTERN = /^(apps|packages|docs|scripts)\//;
const EXT_PATTERN = /\.(js|mjs|ts|tsx|json|css)$/i;
const MAX_ARGS_LENGTH = 2000;

function getStagedFiles() {
	const result = spawnSync(
		"git",
		["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
		{ encoding: "utf8" },
	);

	if (result.status !== 0) {
		process.stderr.write(result.stderr || "Failed to read staged files.\n");
		process.exit(result.status ?? 1);
	}

	return result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((file) => SCOPE_PATTERN.test(file) && EXT_PATTERN.test(file));
}

function chunkFiles(files) {
	const chunks = [];
	let current = [];
	let currentLength = 0;

	for (const file of files) {
		const nextLength =
			currentLength === 0 ? file.length : currentLength + 1 + file.length;
		if (current.length > 0 && nextLength > MAX_ARGS_LENGTH) {
			chunks.push(current);
			current = [file];
			currentLength = file.length;
			continue;
		}

		current.push(file);
		currentLength = nextLength;
	}

	if (current.length > 0) {
		chunks.push(current);
	}

	return chunks;
}

function runBiome(command, files) {
	const biomeBin = path.resolve("node_modules/@biomejs/biome/bin/biome");
	const chunks = chunkFiles(files);

	for (const chunk of chunks) {
		const result = spawnSync(
			process.execPath,
			[biomeBin, command, "--no-errors-on-unmatched", "--write", ...chunk],
			{ stdio: "inherit" },
		);

		if (result.status !== 0) {
			process.exit(result.status ?? 1);
		}
	}
}

const stagedFiles = getStagedFiles();
if (stagedFiles.length === 0) {
	process.exit(0);
}

runBiome("format", stagedFiles);
runBiome("check", stagedFiles);
