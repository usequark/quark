import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const cmsConfigPath = path.join(
	process.cwd(),
	"packages",
	"cms",
	"src",
	"config.js",
);

let cmsConfigPromise;

async function importCmsConfig() {
	try {
		await access(cmsConfigPath);
	} catch {
		return null;
	}

	const cmsModule = await import(pathToFileURL(cmsConfigPath).href);
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
