import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { Script } from "node:vm";
import { ValidationError } from "@techstream/quark-core";

const CMS_CONFIG_RELATIVE_PATHS = [
	"packages/cms/src/config.js",
	"../../packages/cms/src/config.js",
	// In Next standalone, cwd becomes /app/apps/web/.next/standalone/apps/web.
	"../../../../../../packages/cms/src/config.js",
];

let cmsConfigPromise;

function getCmsConfigPaths() {
	return [
		...new Set(
			CMS_CONFIG_RELATIVE_PATHS.map((relativePath) =>
				path.resolve(process.cwd(), relativePath),
			),
		),
	];
}

async function importCmsConfig() {
	const candidatePaths = getCmsConfigPaths();

	for (const candidatePath of candidatePaths) {
		try {
			await access(candidatePath);
		} catch {
			continue;
		}

		return await loadCmsConfigFromFile(candidatePath);
	}

	return null;
}

async function loadCmsConfigFromFile(filePath) {
	const source = await readFile(filePath, "utf-8");

	if (/^\s*import\s+/m.test(source)) {
		throw new ValidationError(
			`CMS config at ${filePath} cannot use import statements in runtime-loaded config.`,
		);
	}

	const transformedSource = source.replace(
		/^\s*export\s+const\s+cmsConfig\s*=/m,
		"const cmsConfig =",
	);

	if (transformedSource === source) {
		throw new ValidationError(`CMS config export not found at ${filePath}.`);
	}

	const script = new Script(`${transformedSource}\n;cmsConfig;`, {
		filename: filePath,
	});

	return script.runInNewContext({});
}

export async function loadCmsConfig() {
	if (!cmsConfigPromise) {
		cmsConfigPromise = importCmsConfig();
	}

	return cmsConfigPromise;
}

export async function hasCmsFeature() {
	return Boolean(await loadCmsConfig());
}

export function resetCmsConfigCache() {
	cmsConfigPromise = undefined;
}
