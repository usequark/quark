import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "@techstream/quark-config";
import { createLogger } from "@techstream/quark-core";
import { pingDatabase } from "@techstream/quark-db";

const logger = createLogger("web-preflight");

export const DEFAULT_DEV_PREFLIGHT_TIMEOUT = 1500;

export async function runWebPreflight({
	loadAppConfig = () => loadConfig({}, { fresh: true }),
	ping = pingDatabase,
	timeout = DEFAULT_DEV_PREFLIGHT_TIMEOUT,
} = {}) {
	loadAppConfig();
	return ping({ timeout });
}

export function formatWebPreflightFailure(result) {
	return [
		`Database preflight failed: ${result.message}`,
		"Start PostgreSQL or check DATABASE_URL / POSTGRES_* before running `pnpm dev`.",
	].join("\n");
}

async function main() {
	if (process.env.QUARK_SKIP_DEV_PREFLIGHT === "1") {
		logger.info("Skipping web dev preflight (QUARK_SKIP_DEV_PREFLIGHT=1)");
		return;
	}

	logger.info("Running web dev preflight...");

	try {
		const result = await runWebPreflight();

		if (result.status === "ok") {
			logger.info(`Database ready (${result.latencyMs}ms)`);
			return;
		}

		logger.error(formatWebPreflightFailure(result));
		process.exit(1);
	} catch (error) {
		logger.error(error?.message ?? String(error));
		process.exit(1);
	}
}

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	void main();
}
