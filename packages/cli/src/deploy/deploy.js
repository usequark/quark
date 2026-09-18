import path from "node:path";
import chalk from "chalk";
import { generateSecret, sleep } from "../utils.js";
import {
	applyIacConfig,
	checkRailwayCLI,
	checkRailwayLogin,
	ensurePlugin,
	ensureRailwayProject,
	escapeTsString,
	generateIacFile,
	getDeploymentStatus,
	getExistingVariable,
	getServiceUrl,
	installRailwaySdk,
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

	// --- Step 6: Preserve existing secrets across deploys ---
	const projectLabel = path.basename(cwd);
	let authSecret;
	let nextAuthSecret;

	if (discovery.services.length > 0) {
		const firstSvc = discovery.services[0];

		const existingAuthSecret = await getExistingVariable("AUTH_SECRET", {
			cwd,
			environment,
			serviceName: firstSvc.name,
		});
		authSecret = existingAuthSecret || generateSecret();

		const existingNextAuthSecret = await getExistingVariable(
			"NEXTAUTH_SECRET",
			{
				cwd,
				environment,
				serviceName: firstSvc.name,
			},
		);
		nextAuthSecret = existingNextAuthSecret || generateSecret();
	}

	// --- Step 7: Generate IaC file (.railway/railway.ts) ---
	console.log(chalk.cyan("  Generating IaC configuration..."));
	const iacPath = `${cwd}/.railway/railway.ts`;

	await generateIacFile({
		iacPath,
		services: discovery.services,
		// Pass raw name — generateIacFile handles escaping internally
		projectName: projectName || projectLabel,
		variableRefs: {
			DATABASE_URL: `\${{${pgServiceName}.DATABASE_URL}}`,
			REDIS_URL: `\${{${redisServiceName}.REDIS_URL}}`,
			NODE_ENV: '"production"',
			APP_NAME: `"${escapeTsString(projectLabel)}"`,
			APP_DESCRIPTION: `"${escapeTsString(`${projectLabel} - Quark application`)}"`,
		},
		secrets: {
			AUTH_SECRET: "preserve()",
			NEXTAUTH_SECRET: "preserve()",
		},
		serviceVars: {
			worker: {
				WORKER_CONCURRENCY: '"5"',
			},
			web: {
				AUTH_ALLOW_SIGNUP: '"false"',
				HOSTNAME: '"0.0.0.0"',
				STORAGE_PROVIDER: '"local"',
			},
		},
	});
	console.log(chalk.green(`  ✔ IaC file generated at .railway/railway.ts`));

	// --- Step 8: Install Railway SDK (required for IaC evaluation) ---
	console.log(chalk.cyan("  Installing Railway SDK..."));
	try {
		await installRailwaySdk({ cwd });
		console.log(chalk.green("  ✔ Railway SDK installed"));
	} catch (error) {
		// SDK is mandatory — railway config apply cannot evaluate .railway/railway.ts without it
		console.error(
			chalk.red(`  ✖ Failed to install Railway SDK: ${error.message}`),
		);
		throw new Error(
			`Railway SDK installation failed. The generated IaC file requires the "railway" package.\n` +
				`Install it manually: pnpm add -D railway\n` +
				`Original error: ${error.message}`,
		);
	}

	// --- Step 9: Set dynamic variable references (infrastructure wiring) ---
	// These values cannot be represented in IaC: Railway reference strings
	// like ${{Postgres.DATABASE_URL}} resolve at runtime, and secrets use
	// preserve() to keep existing Railway-managed values.
	//
	// Variables are set BEFORE IaC apply because:
	// - setProjectVariables uses --skip-deploys (no redundant redeploy)
	// - IaC apply then triggers a single deployment with all variables in place
	// - Status check after apply sees the correct deployment
	let anyVarFailed = false;

	for (const service of discovery.services) {
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
	}

	if (!anyVarFailed) {
		console.log(chalk.green("  ✔ Required variables set"));
	}

	// --- Step 10: Apply IaC configuration ---
	// Apply AFTER variables are set so the resulting deployment uses all
	// configured values. The status check below sees this deployment.
	console.log(chalk.cyan("  Applying IaC configuration..."));
	const applyResult = await applyIacConfig({ cwd });

	if (!applyResult.success) {
		console.error(chalk.red(`  ✖ IaC apply failed: ${applyResult.output}`));
		throw new Error(`IaC apply failed: ${applyResult.output}`);
	}
	console.log(chalk.green("  ✔ IaC configuration applied"));

	// --- Step 11: Verify deployment status after IaC apply ---
	// railway config apply triggers builds but may not wait for them to complete.
	// Poll deployment status to verify the apply actually resulted in a healthy deploy.
	const results = [];

	for (const service of discovery.services) {
		if (service.kind === "web") {
			// Check deployment status
			const { status } = await getDeploymentStatus(service.name, {
				cwd,
				environment,
			});

			if (status === "CRASHED" || status === "FAILED") {
				console.error(
					chalk.red(
						`  ✖ ${service.name} deployment failed (status: ${status})`,
					),
				);
				results.push({
					kind: service.kind,
					name: service.name,
					success: false,
					healthy: false,
					url: null,
				});
				continue;
			}

			// Deployment is building/deploying or succeeded — check health
			const url = await getServiceUrl(service.name, { cwd });
			if (url) {
				console.log(chalk.cyan(`  Checking ${service.name} health...`));
				const healthy = await healthCheckService(url);
				results.push({
					kind: service.kind,
					name: service.name,
					success: true,
					healthy,
					url,
				});
			} else {
				results.push({
					kind: service.kind,
					name: service.name,
					success: status === "SUCCESS" || status === "HEALTHY",
					healthy: false,
					url: null,
				});
			}
		} else {
			// Worker: verify deployment didn't crash
			const { status } = await getDeploymentStatus(service.name, {
				cwd,
				environment,
			});

			const deployed = status !== "CRASHED" && status !== "FAILED";

			// Remove default Railway domain for worker (unused)
			if (deployed) {
				const removed = await removeServiceDomain(service.name, { cwd });
				if (removed) {
					console.log(chalk.dim(`  · Worker domain removed`));
				}
			}

			results.push({
				kind: service.kind,
				name: service.name,
				success: deployed,
				healthy: deployed,
				url: null,
			});
		}
	}

	// --- Step 12: Summary ---
	const allDeployed = results.every((r) => r.success);
	const allHealthy = results.every((r) => r.healthy !== false);

	console.log(chalk.blue.bold("\n📋 Deploy Summary\n"));
	for (const result of results) {
		const icon = result.success ? chalk.green("✔") : chalk.red("✖");
		const healthIcon =
			result.healthy === false ? chalk.yellow(" ⚠ unhealthy") : "";
		const url = result.url ? chalk.white(` → ${result.url}`) : "";
		console.log(`  ${icon} ${result.name}${url}${healthIcon}`);
	}

	if (allDeployed && allHealthy) {
		console.log(chalk.green.bold("\n✅ Deploy complete!\n"));
	} else if (allDeployed && !allHealthy) {
		console.log(
			chalk.yellow.bold("\n⚠ Deploy complete but health check failed!\n"),
		);
		console.log(
			chalk.yellow(
				"  The service was deployed but did not become healthy within the timeout.",
			),
		);
		console.log(
			chalk.yellow("  Check Railway logs: `railway logs --service web`"),
		);
		console.log("");
	} else {
		console.log(chalk.red.bold("\n❌ Deploy failed - see errors above\n"));
	}

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

	if (allDeployed) {
		console.log(chalk.cyan("Next steps:"));
		console.log(
			chalk.white("  1. Configure custom domains in your Railway dashboard"),
		);
		console.log(chalk.white(""));
		console.log(
			chalk.white(
				"  2. Run `quark deploy status` to check deployment status\n",
			),
		);
	}

	return { success: allDeployed, healthy: allHealthy, services: results };
}
