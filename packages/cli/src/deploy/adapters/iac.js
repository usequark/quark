import { execa } from "execa";

const RAILWAY = "railway";

/**
 * Escapes a string for safe embedding in a TypeScript string literal.
 * Handles backslashes, quotes, newlines, and template literal interpolation.
 *
 * @param {string} value
 * @returns {string} The escaped string (without surrounding quotes)
 */
export function escapeTsString(value) {
	return String(value)
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\$/g, "\\$");
}

/**
 * Converts an arbitrary string into a valid JavaScript identifier.
 * Replaces non-alphanumeric characters with underscores, prefixes
 * with `_` if it starts with a digit, and deduplicates underscores.
 *
 * @param {string} value
 * @returns {string} A valid JS identifier (e.g. `my__web__app`)
 */
function toIdentifier(value) {
	return (
		String(value)
			.replace(/[^a-zA-Z0-9]/g, "_")
			.replace(/_+/g, "_")
			.replace(/^(\d)/, "_$1") || "_service"
	);
}

/**
 * Generates a Railway IaC file (.railway/railway.ts) from service contracts.
 *
 * Uses `preserve()` for secrets so Railway keeps existing values.
 * Uses `${{ServiceName.VARIABLE}}` references for provisioned databases.
 * Omits `source` so the CLI deploy flow (railway config apply) manages
 * settings without overwriting a linked GitHub/Docker source.
 *
 * All user-supplied strings (service names, project names, command strings,
 * variable values) are escaped before embedding in the generated TypeScript.
 *
 * @param {object} options
 * @param {string} options.iacPath - Absolute path to .railway/railway.ts
 * @param {Array<object>} options.services - Discovered services from contract.js
 * @param {object} options.secrets - Map of secret key → preserve() or literal value
 * @param {object} options.variableRefs - Map of variable key → Railway reference string
 * @param {object} options.serviceVars - Map of service name → extra env vars
 * @param {string} [options.projectName] - Railway project name (defaults to "quark-app")
 */
export async function generateIacFile({
	iacPath,
	services,
	secrets = {},
	variableRefs = {},
	serviceVars = {},
	projectName = "quark-app",
}) {
	const { default: fs } = await import("fs-extra");
	const { dirname } = await import("node:path");

	const imports = new Set();
	imports.add(`import { defineRailway, project, service } from "railway/iac";`);

	const resourceLines = [];

	for (const svc of services) {
		const svcIdentifier = toIdentifier(svc.name);
		const svcLabel = escapeTsString(svc.name);

		// Build config
		const buildCmd =
			svc.kind === "web"
				? "pnpm install --frozen-lockfile && pnpm db:generate && pnpm --dir apps/web build:deploy"
				: "pnpm install --frozen-lockfile && pnpm db:generate";

		// Deploy config
		const startCmd =
			svc.kind === "web"
				? "HOSTNAME=0.0.0.0 pnpm --dir apps/web start:deploy"
				: "pnpm --dir apps/worker start:deploy";

		const preDeploy = "pnpm db:migrate:deploy";

		// Healthcheck (web only)
		const healthcheck =
			svc.kind === "web"
				? `\n\t\thealthcheck: "/api/health",\n\t\thealthcheckTimeout: 120,`
				: "";

		// Build env vars — escape all string values
		const extraVars = serviceVars[svc.name] || {};
		const envEntries = [
			...Object.entries(variableRefs),
			...Object.entries(secrets),
			...Object.entries(extraVars),
		];

		const envBlock =
			envEntries.length > 0
				? `,\n\t\tenv: {\n${envEntries.map(([k, v]) => `\t\t\t${escapeTsString(k)}: ${v},`).join("\n")}\n\t\t}`
				: "";

		resourceLines.push(`\tconst ${svcIdentifier} = service("${svcLabel}", {
\t\tbuild: "${escapeTsString(buildCmd)}",
\t\tstart: "${escapeTsString(startCmd)}",
\t\tpreDeploy: "${escapeTsString(preDeploy)}",${healthcheck}${envBlock}
\t});`);
	}

	const resources = services.map((s) => toIdentifier(s.name)).join(", ");

	const content = `${Array.from(imports).join("\n")}

export default defineRailway(() => {
${resourceLines.join("\n\n")}

\treturn project("${escapeTsString(projectName)}", {
\t\tresources: [${resources}],
\t});
});
`;

	await fs.ensureDir(dirname(iacPath));
	await fs.writeFile(iacPath, content, "utf8");
}

/**
 * Runs `railway config apply --yes` to apply IaC configuration.
 *
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @param {number} [options.timeout=120000] - Timeout in ms
 * @returns {Promise<{success: boolean, output: string}>}
 */
export async function applyIacConfig({ cwd, timeout = 120_000 } = {}) {
	try {
		const { stdout, stderr } = await execa(
			RAILWAY,
			["config", "apply", "--yes"],
			{ cwd, timeout, reject: true },
		);
		return { success: true, output: stdout || stderr };
	} catch (error) {
		const output = error.stdout || error.stderr || error.message;
		return { success: false, output };
	}
}

/**
 * Installs the Railway SDK (required for TypeScript IaC evaluation).
 *
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @param {string} [options.packageManager="pnpm"] - Package manager to use
 */
export async function installRailwaySdk({ cwd, packageManager = "pnpm" } = {}) {
	await execa(packageManager, ["add", "-D", "railway"], {
		cwd,
		timeout: 60_000,
	});
}

/**
 * Checks the latest deployment status for a service.
 *
 * @param {string} serviceName
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @param {string} [options.environment] - Railway environment name
 * @returns {Promise<{status: string|null, deploymentId: string|null}>}
 */
export async function getDeploymentStatus(
	serviceName,
	{ cwd, environment } = {},
) {
	const args = ["deployment", "list", "--json", "--service", serviceName];
	if (environment) {
		args.push("--environment", environment);
	}

	try {
		const { stdout } = await execa(RAILWAY, args, {
			cwd,
			timeout: 15_000,
		});
		const deployments = JSON.parse(stdout);
		const latest = Array.isArray(deployments) ? deployments[0] : null;
		if (!latest) return { status: null, deploymentId: null };
		return {
			status: (latest.status || "").toUpperCase(),
			deploymentId: latest.id || null,
		};
	} catch {
		return { status: null, deploymentId: null };
	}
}
