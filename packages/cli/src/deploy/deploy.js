import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { generateSecret, sleep } from "../utils.js";
import {
	checkRailwayCLI,
	checkRailwayLogin,
	deleteService,
	deployService,
	ensurePlugin,
	ensureRailwayProject,
	ensureService,
	getExistingVariable,
	getServiceUrl,
	removeServiceDomain,
	setProjectVariables,
} from "./adapters/index.js";
import { resolveQuarkDeployProject } from "./discovery.js";

async function healthCheckService(url) {
	const healthUrl = `${url.replace(/\/$/, "")}/api/health`;
	const maxWait = 60_000;
	const startTime = Date.now();
	let lastError;

	while (Date.now() - startTime < maxWait) {
		try {
			const response = await fetch(healthUrl, {
				signal: AbortSignal.timeout(5_000),
			});
			if (response.ok) {
				console.log(
					chalk.green(`  ✔ Health check passed (${response.status})`),
				);
				return true;
			}
			lastError = `HTTP ${response.status}`;
		} catch (error) {
			lastError = error.message || "connection refused";
		}
		await sleep(3_000);
	}

	console.log(
		chalk.yellow(`  ⚠ Health check timed out: ${lastError} - verify manually`),
	);
	return false;
}

const VALID_RAILWAY_TOP_LEVEL_KEYS = new Set([
	"$schema",
	"build",
	"deploy",
	"variables",
	"services",
]);

/**
 * Validate each discovered service's railway.json before deploying.
 *
 * Returns `{ issues, warnings }`:
 * - `issues` are blocking problems (missing/invalid config) that abort the deploy.
 * - `warnings` are non-blocking (e.g. unknown top-level keys that Railway ignores).
 */
export async function validateProject(cwd, discovery) {
	const issues = [];
	const warnings = [];

	for (const service of discovery.services) {
		const relativePath = path.join(service.relativeRootDir, "railway.json");
		const rjPath = path.join(cwd, relativePath);

		if (!fs.existsSync(rjPath)) {
			issues.push(
				`Service "${service.name}" missing railway.json at ${relativePath}`,
			);
			continue;
		}

		let config;
		try {
			config = fs.readJsonSync(rjPath);
		} catch (error) {
			issues.push(
				`Service "${service.name}" railway.json is not valid JSON (${relativePath}): ${error.message}`,
			);
			continue;
		}

		if (!config || typeof config !== "object") {
			issues.push(
				`Service "${service.name}" railway.json must be a JSON object (${relativePath})`,
			);
			continue;
		}

		// Known-bug detection: `release` is not a valid Railway manifest key.
		// Migrations run via `deploy.releaseCommand` on the web service only.
		if (config.release) {
			issues.push(
				`Service "${service.name}" railway.json uses an invalid "release" key (${relativePath}). Migrations run via "deploy.releaseCommand" on the web service; remove the "release" block from the worker.`,
			);
		}

		// Surface unknown top-level keys so they don't silently no-op.
		for (const key of Object.keys(config)) {
			if (!VALID_RAILWAY_TOP_LEVEL_KEYS.has(key) && key !== "release") {
				warnings.push(
					`Service "${service.name}" railway.json has unknown top-level key "${key}" (${relativePath}) - Railway will ignore it.`,
				);
			}
		}
	}

	return { issues, warnings };
}

export async function deployToRailway(options = {}) {
	const {
		cwd = process.cwd(),
		projectName,
		projectId,
		environment,
		provision = true,
	} = options;

	console.log(chalk.blue.bold("\n⚡ Deploying to Railway\n"));

	// --- Step 1: Check Railway CLI ---
	console.log(chalk.cyan("  Checking Railway CLI..."));
	const version = await checkRailwayCLI();
	if (!version) {
		console.error(chalk.red("  ✖ Railway CLI not found."));
		console.error(chalk.yellow("  Install: npm install -g @railway/cli"));
		console.error(
			chalk.yellow("  Or:     brew install railwayhq/brew/railway"),
		);
		throw new Error("Railway CLI is required but was not found");
	}
	console.log(chalk.green(`  ✔ Railway CLI detected (${version})`));

	// --- Step 2: Check login ---
	console.log(chalk.cyan("  Checking Railway login..."));
	const user = await checkRailwayLogin();
	if (!user) {
		console.error(chalk.red("  ✖ Not logged into Railway."));
		console.error(chalk.yellow("  Run: railway login"));
		throw new Error("Not logged into Railway");
	}
	console.log(chalk.green(`  ✔ Logged in as ${user}`));

	// --- Step 3: Discover project ---
	console.log(chalk.cyan("  Discovering Quark project..."));
	let discovery;
	try {
		discovery = await resolveQuarkDeployProject(cwd);
	} catch (error) {
		console.error(chalk.red(`  ✖ ${error.message}`));
		throw new Error(`Project discovery failed: ${error.message}`);
	}
	console.log(
		chalk.green(
			`  ✔ Discovered ${discovery.services.length} service(s): ${discovery.services.map((s) => s.name).join(", ")}`,
		),
	);

	// --- Step 3b: Pre-deploy validation ---
	const { issues, warnings } = await validateProject(cwd, discovery);
	for (const warning of warnings) {
		console.warn(chalk.yellow(`  ⚠ ${warning}`));
	}
	if (issues.length > 0) {
		for (const issue of issues) {
			console.error(chalk.red(`  ✖ ${issue}`));
		}
		throw new Error(
			"Pre-deploy validation failed - fix the railway.json issues above",
		);
	}

	// --- Step 4: Ensure Railway project ---
	console.log(chalk.cyan("  Ensuring Railway project..."));
	try {
		const project = await ensureRailwayProject({ projectName, projectId, cwd });
		if (project.created) {
			console.log(
				chalk.green(
					`  ✔ Created Railway project "${project.projectName || projectName || ""}"`,
				),
			);
		} else {
			console.log(chalk.green("  ✔ Railway project linked"));
		}
	} catch (error) {
		console.error(
			chalk.red(`  ✖ Failed to link Railway project: ${error.message}`),
		);
		throw new Error(`Project linking failed: ${error.message}`);
	}

	// --- Step 5: Provision plugins ---
	let pgServiceName = "Postgres";
	let redisServiceName = "Redis";
	if (provision) {
		console.log(chalk.cyan("  Provisioning PostgreSQL..."));
		const pg = await ensurePlugin("postgres", { cwd });
		if (pg.added) {
			console.log(chalk.green("  ✔ PostgreSQL provisioned"));
			if (pg.serviceName) pgServiceName = pg.serviceName;
		} else {
			console.log(chalk.dim("  · PostgreSQL already present or skipped"));
		}

		console.log(chalk.cyan("  Provisioning Redis..."));
		const redis = await ensurePlugin("redis", { cwd });
		if (redis.added) {
			console.log(chalk.green("  ✔ Redis provisioned"));
			if (redis.serviceName) redisServiceName = redis.serviceName;
		} else {
			console.log(chalk.dim("  · Redis already present or skipped"));
		}
	}

	// --- Step 6: Set required project-level variables (preserve existing secrets) ---
	const projectLabel = path.basename(cwd);
	let authSecret;
	let nextAuthSecret;

	// --- Step 7: Generate multi-service railway.json ---
	const rootRailwayJson = path.join(cwd, "railway.json");
	const hadExistingRootRailway = fs.existsSync(rootRailwayJson);
	const servicesConfig = [];

	for (const service of discovery.services) {
		const rjPath = path.join(cwd, service.relativeRootDir, "railway.json");
		if (fs.existsSync(rjPath)) {
			const raw = fs.readJsonSync(rjPath);
			const { $schema, ...config } = raw;
			servicesConfig.push({
				name: service.name,
				rootDir: service.relativeRootDir,
				...config,
			});
		}
	}

	if (servicesConfig.length > 0 && !hadExistingRootRailway) {
		await fs.writeJson(
			rootRailwayJson,
			{
				$schema: "https://railway.com/railway.schema.json",
				services: servicesConfig,
			},
			{ spaces: 2 },
		);
	}

	// --- Step 8: Deploy each service ---
	const results = [];
	const createdServices = [];
	let anyVarFailed = false;

	try {
		for (const [index, service] of discovery.services.entries()) {
			const svc = await ensureService(service.name, { cwd });
			if (svc.created) {
				createdServices.push(service.name);
			}

			// Preserve secrets across deploys (check first service, reuse for all)
			if (index === 0) {
				const existingAuthSecret = await getExistingVariable("AUTH_SECRET", {
					cwd,
					environment,
					serviceName: service.name,
				});
				authSecret = existingAuthSecret || generateSecret();

				const existingNextAuthSecret = await getExistingVariable(
					"NEXTAUTH_SECRET",
					{
						cwd,
						environment,
						serviceName: service.name,
					},
				);
				nextAuthSecret = existingNextAuthSecret || generateSecret();
			}

			// Set variables for this service in a single API call per service
			const sharedVars = [
				{ key: "DATABASE_URL", value: `\${{${pgServiceName}.DATABASE_URL}}` },
				{ key: "REDIS_URL", value: `\${{${redisServiceName}.REDIS_URL}}` },
				{ key: "APP_NAME", value: projectLabel },
				{
					key: "APP_DESCRIPTION",
					value: `${projectLabel} - Quark application`,
				},
				{ key: "NODE_ENV", value: "production" },
				{ key: "AUTH_SECRET", value: authSecret },
				{ key: "NEXTAUTH_SECRET", value: nextAuthSecret },
				{ key: "STORAGE_PROVIDER", value: "local" },
			];

			const webVars = [
				...sharedVars,
				{ key: "AUTH_ALLOW_SIGNUP", value: "false" },
				{ key: "HOSTNAME", value: "0.0.0.0" },
			];

			const workerVars = [
				...sharedVars,
				{ key: "WORKER_CONCURRENCY", value: "5" },
			];

			const serviceVars = service.kind === "worker" ? workerVars : webVars;

			try {
				const ok = await setProjectVariables(serviceVars, {
					cwd,
					environment,
					serviceName: service.name,
				});
				if (!ok) {
					anyVarFailed = true;
				}
			} catch (error) {
				console.error(
					chalk.yellow(
						`  ⚠ Could not set variables for "${service.name}": ${error.message}`,
					),
				);
				anyVarFailed = true;
			}

			try {
				await deployService(service.name, { cwd, environment });
				const url = await getServiceUrl(service.name, { cwd });
				results.push({
					kind: service.kind,
					name: service.name,
					success: true,
					url: service.kind === "worker" ? null : url,
				});
				console.log(chalk.green(`  ✔ ${service.name} deployed`));
				if (service.kind !== "worker" && url) {
					console.log(chalk.white(`    → ${url}`));
				}

				// Post-deploy health check for web service
				if (service.kind === "web" && url) {
					await healthCheckService(url);
				}

				// Remove default Railway domain for worker (unused)
				if (service.kind === "worker") {
					const removed = await removeServiceDomain(service.name, { cwd });
					if (removed) {
						console.log(chalk.dim(`  · Worker domain removed`));
					}
				}
			} catch (error) {
				console.error(chalk.red(`  ✖ ${error.message}`));
				results.push({
					kind: service.kind,
					name: service.name,
					success: false,
					url: null,
				});

				if (createdServices.includes(service.name)) {
					try {
						await deleteService(service.name, { cwd });
						console.log(chalk.dim(`  · Rolled back service "${service.name}"`));
					} catch {
						// Best-effort cleanup
					}
				}
			}
		}
	} finally {
		if (!hadExistingRootRailway && servicesConfig.length > 0) {
			try {
				await fs.unlink(rootRailwayJson);
			} catch {
				// Best-effort cleanup
			}
		}
	}

	if (!anyVarFailed) {
		console.log(chalk.green("  ✔ Required variables set"));
	}

	// --- Step 9: Summary ---
	const allSucceeded = results.every((r) => r.success);

	console.log(chalk.blue.bold("\n📋 Deploy Summary\n"));
	for (const result of results) {
		const icon = result.success ? chalk.green("✔") : chalk.red("✖");
		const url = result.url ? chalk.white(` → ${result.url}`) : "";
		console.log(`  ${icon} ${result.name}${url}`);
	}

	if (allSucceeded) {
		console.log(chalk.green.bold("\n✅ Deploy complete!\n"));

		if (anyVarFailed) {
			console.log(
				chalk.yellow("  ⚠ Some environment variables could not be set."),
			);
			console.log(
				chalk.yellow("     Your services may not work correctly without them."),
			);
			console.log(
				chalk.yellow(
					"     Run `railway variable set KEY=VALUE --service <name>` to fix.\n",
				),
			);
		}

		console.log(chalk.cyan("Next steps:"));
		console.log(
			chalk.white("  1. Configure custom domains in your Railway dashboard"),
		);
		console.log(chalk.white(""));
		console.log(chalk.white("  2. Connect GitHub for auto-deploys on push:"));
		console.log(
			chalk.dim(
				"     Railway dashboard → Project Settings → Git Integration → Connect repo",
			),
		);
		console.log(
			chalk.dim(
				"     Then set per-service config (Root Directory: /, Config as Code Path below):",
			),
		);
		for (const result of results) {
			if (result.success) {
				const configPath = `apps/${result.name === "worker" ? "worker" : result.name}/railway.json`;
				console.log(chalk.dim(`       ${result.name.padEnd(8)} ${configPath}`));
			}
		}
		console.log(chalk.white(""));
		console.log(
			chalk.white(
				"  3. Run `quark deploy status` to check deployment status\n",
			),
		);
	} else {
		console.log(chalk.red.bold("\n❌ Deploy failed - see errors above\n"));
	}

	return { success: allSucceeded, services: results };
}
