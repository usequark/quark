import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const SRC_ROOT = path.join(WEB_ROOT, "src");

export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith("@/")) {
		const rel = specifier.slice(2);
		const base = path.join(SRC_ROOT, rel);
		const candidates = [
			base,
			`${base}.js`,
			`${base}.jsx`,
			path.join(base, "index.js"),
		];
		for (const candidate of candidates) {
			if (existsSync(candidate)) {
				return {
					shortCircuit: true,
					url: pathToFileURL(candidate).href,
				};
			}
		}
	}
	return nextResolve(specifier, context);
}
