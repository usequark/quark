import { execa } from "execa";

const RAILWAY = "railway";

/**
 * Every helper `railway/iac` exports that can appear in a generated body.
 *
 * The import list is derived from the helpers the body actually calls, rather
 * than hardcoded. A helper that is called but not imported is a ReferenceError
 * when the CLI evaluates the file, and that evaluation only happens later, in
 * the user's `railway config apply` — so nothing in this repo ever surfaced it.
 * Deriving the list makes the two impossible to drift apart.
 */
const IAC_HELPERS = [
	"bucket",
	"database",
	"defineRailway",
	"group",
	"image",
	"postgres",
	"preserve",
	"project",
	"redis",
	"service",
	"volume",
];

/**
 * Builds a Railway variable reference as a TypeScript *string literal*.
 *
 * Railway's `${{Service.VAR}}` syntax is only reference syntax inside a quoted
 * string. Emitted bare it is not a valid expression — `${{` parses as an object
 * literal that opens and never closes — so the file fails to parse before
 * Railway ever sees it. The value must therefore carry its own quotes.
 *
 * Only for values embedded in generated TypeScript. A value passed to
 * `railway variable set` on a command line wants the bare, unquoted form.
 *
 * @param {string} serviceName - Railway service the variable lives on
 * @param {string} variableName - Variable name on that service
 * @returns {string} A quoted reference, e.g. `"${{Postgres.DATABASE_URL}}"`
 */
export function iacRef(serviceName, variableName) {
	return `"$\{{${serviceName}.${variableName}}}"`;
}

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
 * @returns {Promise<{content: string, changed: boolean, previous: string|null}>}
 *   `changed` is false when the file on disk already matched, in which case no
 *   write happened. `previous` is the content that was replaced, or null.
 */
export async function generateIacFile({
	iacPath,
	services,
	secrets = {},
	variableRefs = {},
	serviceVars = {},
	projectName = "quark-app",
	provision = true,
}) {
	const { default: fs } = await import("fs-extra");
	const { dirname } = await import("node:path");

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

		// Each entry is one complete `key: value` field, and the object body is
		// rendered by joining them. Concatenating pre-rendered blocks instead
		// means each block has to guess whether it owns the separator between it
		// and its neighbour — and when two blocks both assume they do, the file
		// ships with `healthcheckTimeout: 120,,`, which does not parse. A field
		// list makes that unrepresentable: there is exactly one join.
		const fields = [
			`build: "${escapeTsString(buildCmd)}"`,
			`start: "${escapeTsString(startCmd)}"`,
			`preDeploy: "${escapeTsString(preDeploy)}"`,
		];

		// Healthcheck (web only)
		if (svc.kind === "web") {
			fields.push('healthcheck: "/api/health"', "healthcheckTimeout: 120");
		}

		// Env vars — escape all string values
		const extraVars = serviceVars[svc.name] || {};
		const envEntries = [
			...Object.entries(variableRefs),
			...Object.entries(secrets),
			...Object.entries(extraVars),
		];

		if (envEntries.length > 0) {
			const envLines = envEntries
				.map(([k, v]) => `\t\t\t${escapeTsString(k)}: ${v},`)
				.join("\n");
			fields.push(`env: {\n${envLines}\n\t\t}`);
		}

		resourceLines.push(
			`\tconst ${svcIdentifier} = service("${svcLabel}", {\n\t\t${fields.join(",\n\t\t")},\n\t});`,
		);
	}

	// `postgres` and `redis` are dedicated helpers; anything else falls back to
	// the generic `database` helper. Both are already in IAC_HELPERS, so the
	// import list picks them up automatically.
	const DATABASE_HELPERS = { Postgres: "postgres", Redis: "redis" };

	// Declare every database the services reference, so a whole-project apply
	// does not plan to delete it.
	//
	// Railway treats an omitted resource in a single-file project as absent, and
	// absent means delete: "One project definition, one apply, and omitting a
	// resource means deleting it." The databases are provisioned out-of-band by
	// `ensurePlugin()` (`railway add --database`), then referenced here via
	// `${{Postgres.DATABASE_URL}}`. Without this block a second deploy plans to
	// destroy the databases the first one created.
	//
	// When `provision` is false (`--no-provision`), we must distinguish two
	// cases:
	//
	// 1. A fresh project that has never been provisioned: no databases should be
	//    declared, because declaring them would provision them on the next apply
	//    — exactly what the user opted out of.
	//
	// 2. An existing project whose databases were provisioned by an earlier
	//    deploy: those databases are already managed by this file. Removing
	//    their declarations would make `railway config apply` delete them,
	//    because omitted resources are deletions. So we preserve any database
	//    that the existing file already declares, and only suppress declarations
	//    that would be new.
	let previousContent = null;
	try {
		previousContent = await fs.readFile(iacPath, "utf8");
	} catch {
		previousContent = null;
	}

	const serviceIdentifiers = new Set(services.map((s) => toIdentifier(s.name)));
	const databaseNames = new Set();
	const referencePattern = /\$\{\{([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\}\}/g;

	for (const value of Object.values(variableRefs)) {
		for (const match of String(value).matchAll(referencePattern)) {
			if (!serviceIdentifiers.has(match[1])) {
				databaseNames.add(match[1]);
			}
		}
	}

	if (!provision) {
		// Preserve databases the existing file already declares; suppress only
		// declarations that would be new. When there is no existing file, no
		// databases are already declared, so all are suppressed.
		for (const dbName of [...databaseNames]) {
			const alreadyDeclared =
				previousContent !== null &&
				new RegExp(
					`\\b${DATABASE_HELPERS[dbName] ?? "database"}\\s*\\(\\s*["']${escapeTsString(dbName)}["']`,
				).test(previousContent);
			if (!alreadyDeclared) {
				databaseNames.delete(dbName);
			}
		}
	}

	const sortedDatabases = [...databaseNames].sort();

	for (const dbName of sortedDatabases) {
		const helper = DATABASE_HELPERS[dbName] ?? "database";
		const dbIdentifier = `${toIdentifier(dbName)}Db`;
		resourceLines.push(
			`\tconst ${dbIdentifier} = ${helper}("${escapeTsString(dbName)}");`,
		);
	}

	const resources = [
		...services.map((s) => toIdentifier(s.name)),
		...sortedDatabases.map((name) => `${toIdentifier(name)}Db`),
	].join(", ");

	const body = `export default defineRailway(() => {
${resourceLines.join("\n\n")}

	return project("${escapeTsString(projectName)}", {
		resources: [${resources}],
	});
});
`;

	// Derive the import list from the body so a helper can never be called
	// without being in scope. See IAC_HELPERS.
	const used = IAC_HELPERS.filter((helper) =>
		new RegExp(`\\b${helper}\\s*\\(`).test(body),
	).sort();

	const content = `import { ${used.join(", ")} } from "railway/iac";

${body}`;

	await fs.ensureDir(dirname(iacPath));

	// `.railway/railway.ts` is a tracked file that every scaffold ships with a
	// hand-written copy of. Overwriting it silently is how a deploy once
	// replaced a committed file with generated output and the user only found
	// out from `git status` afterwards. So: skip the write when nothing changed,
	// and hand the previous content back when something did, so the caller can
	// show the diff. The file is tracked, so `git checkout` remains the escape
	// hatch — this only makes the change visible at the moment it happens.
	let previous = null;
	try {
		previous = await fs.readFile(iacPath, "utf8");
	} catch {
		previous = null;
	}

	const changed = previous !== content;
	if (changed) {
		await fs.writeFile(iacPath, content, "utf8");
	}

	return { content, changed, previous };
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
 * Checks whether the `railway` package already resolves from `cwd`.
 *
 * Walks up from `cwd` the way Node's resolver does, so a hoisted install in a
 * pnpm workspace root is found from a package directory too.
 *
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @returns {Promise<boolean>}
 */
export async function hasRailwaySdk({ cwd } = {}) {
	const { default: fs } = await import("fs-extra");
	const { dirname, join, parse, resolve } = await import("node:path");

	const root = parse(resolve(cwd)).root;
	let dir = resolve(cwd);

	while (dir !== root) {
		if (
			await fs.pathExists(join(dir, "node_modules", "railway", "package.json"))
		) {
			return true;
		}
		dir = dirname(dir);
	}

	return false;
}

/**
 * Installs the Railway SDK (required for TypeScript IaC evaluation).
 *
 * No-op when the package already resolves, so a repeat deploy does not touch
 * package.json or the lockfile again.
 *
 * `-w` is passed explicitly because every scaffolded project is a pnpm
 * workspace and the SDK is added at the root. Current pnpm versions accept the
 * bare form, but older ones reject it with `ERR_PNPM_ADDING_TO_ROOT` and name
 * the same command as the remedy, so being explicit is the only version this
 * has to reason about.
 *
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @param {string} [options.packageManager="pnpm"] - Package manager to use
 * @returns {Promise<{installed: boolean, alreadyPresent: boolean}>}
 */
export async function installRailwaySdk({ cwd, packageManager = "pnpm" } = {}) {
	if (await hasRailwaySdk({ cwd })) {
		return { installed: false, alreadyPresent: true };
	}

	const args = ["add", "-D"];
	if (packageManager === "pnpm") {
		args.push("-w");
	}
	args.push("railway");

	await execa(packageManager, args, {
		cwd,
		timeout: 60_000,
	});
	return { installed: true, alreadyPresent: false };
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
