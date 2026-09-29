import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	formatWebPreflightFailure,
	runWebPreflight,
} from "../apps/web/src/preflight.js";
import { maybeAutoClean } from "./clean-workspace.mjs";

export async function runDevPreflight({ logger = console } = {}) {
	if (process.env.QUARK_SKIP_DEV_PREFLIGHT === "1") {
		logger.log("Skipping Quark dev preflight (QUARK_SKIP_DEV_PREFLIGHT=1)");
		return { status: "skipped" };
	}

	logger.log("Running Quark dev preflight...");

	const result = await runWebPreflight();

	if (result.status === "ok") {
		logger.log(`Database ready (${result.latencyMs}ms)`);
		try {
			maybeAutoClean({ logger });
		} catch (error) {
			logger.warn?.(
				`Quark auto-clean failed: ${error?.message ?? String(error)}`,
			);
		}
		return result;
	}

	logger.error(formatWebPreflightFailure(result));
	process.exit(1);
}

async function main() {
	try {
		await runDevPreflight();
	} catch (error) {
		console.error(error?.message ?? String(error));
		process.exit(1);
	}
}

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	void main();
}
