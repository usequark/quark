import { access } from "node:fs/promises";
import path from "node:path";

const CRM_PATHS = [
	"packages/crm/src/config.js",
	"../../packages/crm/src/config.js",
	"../../../../../../packages/crm/src/config.js",
];

let crmAvailable;

async function checkCrmExists() {
	for (const relativePath of CRM_PATHS) {
		try {
			await access(path.resolve(process.cwd(), relativePath));
			return true;
		} catch {}
	}
	return false;
}

export async function loadCrmConfig() {
	if (crmAvailable === undefined) {
		crmAvailable = await checkCrmExists();
	}
	return crmAvailable ? { present: true } : null;
}

export async function hasCrmFeature() {
	return Boolean(await loadCrmConfig());
}

export function resetCrmConfigCache() {
	crmAvailable = undefined;
}
