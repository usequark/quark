import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const standaloneRoot = path.join(appRoot, ".next", "standalone", "apps", "web");

async function assertExists(targetPath, description) {
	try {
		await access(targetPath);
	} catch {
		throw new Error(
			`${description} was not found at ${targetPath}. Run "pnpm build" in apps/web before preparing the standalone artifact.`,
		);
	}
}

async function copyIntoStandalone(sourcePath, destinationPath) {
	await mkdir(path.dirname(destinationPath), { recursive: true });
	await cp(sourcePath, destinationPath, { recursive: true, force: true });
}

async function main() {
	await assertExists(
		path.join(standaloneRoot, "server.js"),
		"The standalone server output",
	);
	await assertExists(
		path.join(appRoot, "public"),
		"The public asset directory",
	);
	await assertExists(
		path.join(appRoot, ".next", "static"),
		"The Next static asset directory",
	);

	await copyIntoStandalone(
		path.join(appRoot, "public"),
		path.join(standaloneRoot, "public"),
	);
	await copyIntoStandalone(
		path.join(appRoot, ".next", "static"),
		path.join(standaloneRoot, ".next", "static"),
	);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
