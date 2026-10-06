import path from "node:path";
import chalk from "chalk";
import { execa } from "execa";
import fs from "fs-extra";
import { sleep } from "../../utils.js";

export const RAILWAY = "railway";

export const DIAGNOSTIC_CODES = Object.freeze({
	RAILWAY_CLI_NOT_FOUND: "railway_cli_not_found",
	RAILWAY_NOT_LOGGED_IN: "railway_not_logged_in",
	RAILWAY_LINK_FAILED: "railway_link_failed",
	RAILWAY_DEPLOY_FAILED: "railway_deploy_failed",
});

export class RailwayError extends Error {
	constructor(message, code, meta) {
		super(message);
		this.name = "RailwayError";
		this.code = code;
		this.meta = meta;
	}
}

export async function checkRailwayCLI() {
	try {
		const { stdout } = await execa(RAILWAY, ["--version"], { timeout: 10_000 });
		return stdout.trim();
	} catch {
		return null;
	}
}

export async function checkRailwayLogin() {
	try {
		const { stdout } = await execa(RAILWAY, ["whoami"], { timeout: 10_000 });
		const emailMatch = stdout.trim().match(/\(([^)]+@[^)]+)\)/);
		return emailMatch ? emailMatch[1] : stdout.trim();
	} catch {
		return null;
	}
}

export async function isProjectLinked(cwd) {
	const { projectId } = await readLinkedProject({ cwd });
	return projectId !== null;
}

export async function tryLinkProject(projectId, { cwd } = {}) {
	try {
		await execa(RAILWAY, ["link", "--project", projectId], {
			cwd,
			timeout: 30_000,
		});
		return true;
	} catch {
		return false;
	}
}

export async function listProjects({ cwd } = {}) {
	try {
		const { stdout } = await execa(RAILWAY, ["list", "--json"], {
			cwd,
			timeout: 15_000,
		});
		const all = JSON.parse(stdout);
		return Array.isArray(all) ? all.filter((p) => !p.deletedAt) : [];
	} catch {
		return [];
	}
}

/**
 * Reads the Railway project this directory is linked to.
 *
 * Two layouts are in play, because the CLI moved:
 *
 * - Railway CLI 3.x wrote `.railway/config.json` inside the project directory,
 *   holding only `projectId` — no name to be found in it.
 * - Railway CLI 5.x (verified against 5.62.1) keeps every link in
 *   `~/.railway/config.json`, in a `projects` map keyed by absolute directory,
 *   with `project` (the id) and `name` alongside it. A linked project
 *   directory contains `.railway/railway.ts` and nothing else.
 *
 * Both are read, per-project first. The `~/.railway` file also holds the user's
 * OAuth tokens; only the `projects` map is read and nothing else from it is
 * ever returned or logged.
 *
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @returns {Promise<{projectId: string|null, projectName: string|null}>}
 */
export async function readLinkedProject({ cwd } = {}) {
	const fromProjectDir = await readProjectDirLink(cwd);
	if (fromProjectDir.projectId) return fromProjectDir;

	return readUserConfigLink(cwd);
}

/** Railway CLI 3.x layout: `.railway/config.json` in the project directory. */
async function readProjectDirLink(cwd) {
	const railwayDir = path.join(cwd, ".railway");
	try {
		const entries = await fs.readdir(railwayDir);
		for (const entry of entries.filter((e) => e.endsWith(".json"))) {
			try {
				const parsed = JSON.parse(
					await fs.readFile(path.join(railwayDir, entry), "utf8"),
				);
				const projectId = parsed?.projectId ?? null;
				const projectName = parsed?.projectName ?? parsed?.name ?? null;
				if (projectId || projectName) return { projectId, projectName };
			} catch {
				// Not the file we were after, or unparseable — try the next.
			}
		}
	} catch {
		// No .railway directory, or not readable.
	}
	return { projectId: null, projectName: null };
}

/**
 * Railway CLI 5.x layout: `~/.railway/config.json`, `projects` keyed by
 * absolute directory path.
 */
async function readUserConfigLink(cwd) {
	const empty = { projectId: null, projectName: null };

	const home = process.env.HOME ?? process.env.USERPROFILE;
	if (!home) return empty;

	try {
		const parsed = JSON.parse(
			await fs.readFile(path.join(home, ".railway", "config.json"), "utf8"),
		);
		const projects = parsed?.projects;
		if (!projects || typeof projects !== "object") return empty;

		const target = path.resolve(cwd);
		const entry =
			projects[target] ??
			Object.values(projects).find(
				(v) =>
					typeof v?.projectPath === "string" &&
					path.resolve(v.projectPath) === target,
			);
		if (!entry) return empty;

		return {
			projectId: entry.project ?? null,
			projectName: entry.name ?? null,
		};
	} catch {
		// No user config, unparseable, or unreadable — treat as unlinked.
		return empty;
	}
}

/**
 * Resolves a project id to its name via the API, for when the link record
 * carries only an id.
 *
 * @param {string} projectId
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @returns {Promise<string|null>}
 */
export async function resolveProjectName(projectId, { cwd } = {}) {
	if (!projectId) return null;
	const match = (await listProjects({ cwd })).find((p) => p.id === projectId);
	return match?.name ?? null;
}

/**
 * Best-effort name for a linked project: the link record when it carries one,
 * otherwise resolved from its id.
 *
 * @param {object} options
 * @param {string} options.cwd - Project root directory
 * @returns {Promise<{projectId: string|null, projectName: string|null}>}
 */
async function linkedProjectWithName({ cwd }) {
	const linked = await readLinkedProject({ cwd });
	if (linked.projectName || !linked.projectId) return linked;

	const projectName = await resolveProjectName(linked.projectId, { cwd });
	return { projectId: linked.projectId, projectName };
}

export async function ensureRailwayProject({
	projectName,
	projectId,
	cwd,
} = {}) {
	const alreadyLinked = await isProjectLinked(cwd);

	if (alreadyLinked) {
		try {
			await execa(RAILWAY, ["status"], { cwd, timeout: 15_000 });
			// Report the linked name rather than null: callers label generated
			// IaC and app metadata from it, and falling back to the local
			// directory name is how a project called `quark-site` ended up
			// advertising itself as whatever directory it was deployed from.
			const linked = await linkedProjectWithName({ cwd });
			return {
				created: false,
				linked: true,
				projectName: linked.projectName,
			};
		} catch {
			// Stale link - clear it so we don't create an orphan project.
			// `railway unlink` is what actually removes the link; it lives in
			// ~/.railway on CLI 5.x, so deleting .railway/ here would only
			// destroy the IaC file while leaving the stale link in place.
			try {
				await execa(RAILWAY, ["unlink"], { cwd, timeout: 15_000 });
			} catch {
				// Nothing to unlink, or it failed — fall through either way.
			}
		}
	}

	if (projectId) {
		await execa(RAILWAY, ["link", "--project", projectId], {
			cwd,
			timeout: 30_000,
		});
		const projectName = await resolveProjectName(projectId, { cwd });
		return { created: false, linked: true, projectName };
	}

	if (!projectName) {
		projectName = path.basename(path.resolve(cwd));
	}

	// Check if a project with this name already exists on Railway
	// before calling init (which would create "quark-1", "quark-2", etc.)
	const existing = await listProjects({ cwd });
	const match = existing.find((p) => p.name === projectName);
	if (match) {
		await execa(RAILWAY, ["link", "--project", match.id], {
			cwd,
			timeout: 30_000,
		});
		return { created: false, linked: true, projectName: match.name };
	}

	// Create new project with a single retry for transient API failures
	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			await execa(RAILWAY, ["init", "--name", projectName, "--json"], {
				cwd,
				timeout: 60_000,
			});
			return { created: true, linked: true, projectName };
		} catch (error) {
			if (attempt === 2) {
				// Check if the project was actually created despite the error
				const updated = await listProjects({ cwd });
				const created = updated.find(
					(p) => p.name === projectName || p.name === `${projectName}-1`,
				);
				if (created) {
					await execa(RAILWAY, ["link", "--project", created.id], {
						cwd,
						timeout: 30_000,
					});
					return { created: true, linked: true, projectName: created.name };
				}

				const stderr = error.stderr || "";
				if (stderr.includes("already exists")) {
					const retryMatch = updated.find((p) => p.name === projectName);
					if (retryMatch) {
						await execa(RAILWAY, ["link", "--project", retryMatch.id], {
							cwd,
							timeout: 30_000,
						});
						return {
							created: false,
							linked: true,
							projectName: retryMatch.name,
						};
					}
				}

				throw error;
			}
		}
	}
}

export async function ensurePlugin(pluginName, { cwd } = {}) {
	try {
		const { stdout } = await execa(
			RAILWAY,
			["add", "--database", pluginName, "--json"],
			{
				cwd,
				timeout: 60_000,
			},
		);
		// --json output: [{ name, id, ... }] or { name, id }
		const parsed = JSON.parse(stdout);
		const serviceInfo = Array.isArray(parsed) ? parsed[0] : parsed;
		const rawName = serviceInfo?.name || pluginName;
		const serviceName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
		return {
			added: true,
			serviceName,
			serviceId: serviceInfo?.id || null,
		};
	} catch (error) {
		const stderr = error.stderr || "";
		if (stderr.includes("already exists") || stderr.includes("already")) {
			return { added: false, exists: true };
		}
		throw new RailwayError(
			`Failed to provision ${pluginName}: ${error.message}`,
			DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
			{ pluginName, stderr },
		);
	}
}

export async function ensureService(serviceName, { cwd } = {}) {
	try {
		await execa(RAILWAY, ["add", "--service", serviceName, "--json"], {
			cwd,
			timeout: 30_000,
		});
		return { created: true };
	} catch (error) {
		const stderr = error.stderr || "";
		if (stderr.includes("already exists") || stderr.includes("already")) {
			return { created: false, exists: true };
		}
		return { created: false, exists: false };
	}
}

export async function deployService(serviceName, { cwd, environment } = {}) {
	const args = ["up", "--service", serviceName, "--detach", "--json"];
	if (environment) {
		args.push("--environment", environment);
	}

	let deploymentId;
	try {
		const { stdout } = await execa(RAILWAY, args, {
			cwd,
			timeout: 120_000,
		});
		const parsed = JSON.parse(stdout);
		deploymentId = parsed?.deploymentId || parsed?.id;
		if (!deploymentId) {
			throw new RailwayError(
				`No deployment ID returned for "${serviceName}"`,
				DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
			);
		}
	} catch (error) {
		if (error instanceof RailwayError) throw error;
		throw new RailwayError(
			`Failed to start deployment for "${serviceName}": ${error.message}`,
			DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
			{ serviceName, stderr: error.stderr },
		);
	}

	// Poll for deployment completion via deployment list (status field)
	const pollArgs = ["deployment", "list", "--json", "--service", serviceName];
	if (environment) {
		pollArgs.push("--environment", environment);
	}

	const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	let spinIdx = 0;
	const spinner = setInterval(() => {
		spinIdx = (spinIdx + 1) % spinnerChars.length;
		process.stdout.write(
			`\r  ${chalk.cyan(spinnerChars[spinIdx])} Deploying ${serviceName}...`,
		);
	}, 100);

	const startTime = Date.now();
	const maxWait = 600_000; // 10 minute overall timeout

	try {
		while (Date.now() - startTime < maxWait) {
			await sleep(5_000);
			let deployments;
			try {
				const { stdout } = await execa(RAILWAY, pollArgs, {
					cwd,
					timeout: 15_000,
				});
				deployments = JSON.parse(stdout);
			} catch {
				continue;
			}

			const deploy = Array.isArray(deployments)
				? deployments.find((d) => d.id === deploymentId)
				: null;
			if (!deploy) continue;

			const status = (deploy.status || "").toUpperCase();

			if (status === "SUCCESS" || status === "HEALTHY") {
				clearInterval(spinner);
				process.stdout.write(
					`\r  ${chalk.green("✔")} Deploying ${serviceName}... done\n`,
				);
				return { serviceName, success: true, deploymentId };
			}

			if (status === "CRASHED" || status === "FAILED") {
				clearInterval(spinner);
				process.stdout.write(
					`\r  ${chalk.red("✖")} Deploying ${serviceName}... failed\n`,
				);
				throw new RailwayError(
					`Deployment failed for "${serviceName}" (status: ${status})`,
					DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
					{ serviceName, deploymentId, status },
				);
			}
		}

		clearInterval(spinner);
		process.stdout.write(
			`\r  ${chalk.red("✖")} Deploying ${serviceName}... timed out\n`,
		);
		throw new RailwayError(
			`Deployment timed out for "${serviceName}" after 10 minutes`,
			DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
			{ serviceName, deploymentId },
		);
	} catch (error) {
		clearInterval(spinner);
		if (error instanceof RailwayError) throw error;
		throw new RailwayError(
			`Failed to check deployment status for "${serviceName}": ${error.message}`,
			DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
			{ serviceName, deploymentId },
		);
	}
}

export async function deleteService(serviceName, { cwd, environment } = {}) {
	const args = [
		"service",
		"delete",
		"--service",
		serviceName,
		"--yes",
		"--json",
	];
	if (environment) {
		args.push("--environment", environment);
	}

	try {
		await execa(RAILWAY, args, { cwd, timeout: 30_000 });
		return true;
	} catch {
		return false;
	}
}

export async function getExistingVariable(
	key,
	{ cwd, environment, serviceName } = {},
) {
	const args = ["variable", "list", "--json"];
	if (serviceName) {
		args.push("--service", serviceName);
	}
	if (environment) {
		args.push("--environment", environment);
	}

	try {
		const { stdout } = await execa(RAILWAY, args, { cwd, timeout: 10_000 });
		const vars = JSON.parse(stdout);
		if (Array.isArray(vars)) {
			const found = vars.find((v) => v.name === key || v.key === key);
			return found?.value || found?.rawValue || null;
		}
		if (vars && typeof vars === "object") {
			return vars[key] || null;
		}
		return null;
	} catch {
		return null;
	}
}

export async function getServiceUrl(serviceName, { cwd } = {}) {
	try {
		const { stdout } = await execa(
			RAILWAY,
			["domain", "--service", serviceName, "--json"],
			{
				cwd,
				timeout: 15_000,
			},
		);
		const parsed = JSON.parse(stdout);
		return parsed?.[0]?.domain || parsed?.domain || null;
	} catch {
		return null;
	}
}

export async function setProjectVariable(
	key,
	value,
	{ cwd, environment, serviceName } = {},
) {
	const args = [
		"variable",
		"set",
		`${key}=${value}`,
		"--json",
		"--skip-deploys",
	];
	if (serviceName) {
		args.push("--service", serviceName);
	}
	if (environment) {
		args.push("--environment", environment);
	}

	try {
		await execa(RAILWAY, args, { cwd, timeout: 60_000 });
		return true;
	} catch (error) {
		const errMsg = error.stderr?.trim() || error.shortMessage || error.message;
		throw new RailwayError(
			`Failed to set variable "${key}" for service "${serviceName || "(default)"}": ${errMsg}`,
			DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
			{ key, value, serviceName, environment },
		);
	}
}

export async function setProjectVariables(
	vars,
	{ cwd, environment, serviceName } = {},
) {
	const args = [
		"variable",
		"set",
		...vars.map(({ key, value }) => `${key}=${value}`),
		"--json",
		"--skip-deploys",
	];
	if (serviceName) {
		args.push("--service", serviceName);
	}
	if (environment) {
		args.push("--environment", environment);
	}

	const maxWait = 120_000;

	try {
		await execa(RAILWAY, args, { cwd, timeout: maxWait });
		return true;
	} catch (error) {
		const errMsg = error.stderr?.trim() || error.shortMessage || error.message;

		// Check if variables were actually set despite the timeout
		// by verifying the first and last keys.
		const sampleKeys = [];
		if (vars.length > 0) {
			sampleKeys.push(vars[0].key);
			if (vars.length > 1) {
				sampleKeys.push(vars[vars.length - 1].key);
			}
		}
		let allSet = sampleKeys.length > 0;
		for (const key of sampleKeys) {
			try {
				const existing = await getExistingVariable(key, {
					cwd,
					environment,
					serviceName,
				});
				if (!existing) {
					allSet = false;
				}
			} catch {
				allSet = false;
			}
		}
		if (allSet) {
			return true;
		}

		throw new RailwayError(
			`Failed to set variables for service "${serviceName || "(default)"}": ${errMsg}`,
			DIAGNOSTIC_CODES.RAILWAY_DEPLOY_FAILED,
			{ vars, serviceName, environment },
		);
	}
}

export async function removeServiceDomain(serviceName, { cwd } = {}) {
	try {
		const url = await getServiceUrl(serviceName, { cwd });
		if (!url) return false;
		await execa(RAILWAY, ["domain", "remove", "--service", serviceName, url], {
			cwd,
			timeout: 15_000,
		});
		return true;
	} catch {
		return false;
	}
}

export async function getProjectDomains({ cwd } = {}) {
	try {
		const { stdout } = await execa(RAILWAY, ["domain", "--json"], {
			cwd,
			timeout: 15_000,
		});
		return JSON.parse(stdout);
	} catch {
		return [];
	}
}
