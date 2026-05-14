import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_CMS_CONFIG_RELATIVE_PATHS = [
	"packages/cms/src/config.js",
	"../../packages/cms/src/config.js",
	"../../../../../../packages/cms/src/config.js",
];

let cmsConfigPromise;

// Turbopack rejects variable import() expressions in server code even when the
// target is a local file URL discovered at runtime. Wrapping import() in a
// Function keeps this optional file load on the Node side.
const importModuleAtRuntime = new Function(
	"specifier",
	"return import(specifier);",
);

function getDefaultCmsConfigPaths() {
	return [
		...new Set(
			DEFAULT_CMS_CONFIG_RELATIVE_PATHS.map((relativePath) =>
				path.resolve(process.cwd(), relativePath),
			),
		),
	];
}

async function resolveCmsConfigPath() {
	for (const candidatePath of getDefaultCmsConfigPaths()) {
		try {
			await access(candidatePath);
			return candidatePath;
		} catch {}
	}

	return null;
}

async function importCmsConfig() {
	const cmsConfigPath = await resolveCmsConfigPath();
	if (!cmsConfigPath) {
		return null;
	}

	const cmsModule = await importModuleAtRuntime(
		pathToFileURL(cmsConfigPath).href,
	);
	return cmsModule.cmsConfig ?? null;
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
