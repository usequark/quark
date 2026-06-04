import path from "node:path";
import chalk from "chalk";
import { execa } from "execa";
import fs from "fs-extra";
import {
	checkRailwayCLI,
	checkRailwayLogin,
	getProjectDomains,
	isProjectLinked,
	RAILWAY,
} from "./adapters/index.js";
import { discoverQuarkDeployProject } from "./discovery.js";

function formatBool(value) {
	return value ? chalk.green("✔ yes") : chalk.red("✖ no");
}

export async function inspectProject(options = {}) {
	const { cwd = process.cwd() } = options;

	console.log(chalk.blue.bold("\n🔍 Quark Deploy Inspection\n"));

	// --- Service discovery ---
	console.log(chalk.cyan("  Project Services\n"));

	const discovery = await discoverQuarkDeployProject(cwd);

	if (discovery.services.length === 0) {
		console.log(chalk.yellow("  No Quark services discovered."));
	} else {
		for (const service of discovery.services) {
			console.log(`  ${chalk.bold(service.name)}`);
			console.log(
				`    Package:    ${service.packageName ?? chalk.dim("unknown")}`,
			);
			console.log(`    Root:       ${service.relativeRootDir}`);
			console.log(`    Entrypoint: ${service.runtime.relativeEntrypoint}`);
			if (service.runtime.healthcheckPath) {
				console.log(`    Health:     ${service.runtime.healthcheckPath}`);
			}
			console.log(
				`    Required:   ${service.required ? chalk.green("yes") : chalk.dim("no")}`,
			);
			console.log();
		}
	}

	// --- Diagnostics ---
	if (discovery.diagnostics.length > 0) {
		console.log(chalk.yellow("  Diagnostics\n"));
		for (const diagnostic of discovery.diagnostics) {
			console.log(`  ${chalk.yellow("⚠")} ${diagnostic.message}`);
		}
		console.log();
	}

	// --- Railway readiness ---
	console.log(chalk.cyan("  Railway Readiness\n"));

	const railCLIVersion = await checkRailwayCLI();
	console.log(`  CLI installed:  ${formatBool(!!railCLIVersion)}`);
	if (railCLIVersion) {
		console.log(`    Version:       ${railCLIVersion}`);
	}

	const railUser = await checkRailwayLogin();
	console.log(`  Logged in:      ${formatBool(!!railUser)}`);
	if (railUser) {
		console.log(`    User:          ${railUser}`);
	}

	const linked = await isProjectLinked(cwd);
	console.log(`  Project linked: ${formatBool(linked)}`);

	if (linked) {
		const domains = await getProjectDomains({ cwd });
		if (domains.length > 0) {
			console.log(chalk.green("\n  Deployed Services\n"));
			for (const domain of domains) {
				console.log(
					`    ${domain.service ?? chalk.dim("unknown")}: ${domain.domain ?? chalk.dim("no domain")}`,
				);
			}
		}
	}

	// --- Service Status ---
	if (linked) {
		console.log(chalk.cyan("  Service Status\n"));

		try {
			const configPath = path.join(cwd, ".railway", "config.json");
			const config = fs.readJsonSync(configPath);
			const projectId = config.project;

			const { stdout } = await execa(RAILWAY, ["service", "list", "--json"], {
				cwd,
				timeout: 15_000,
			});
			const services = JSON.parse(stdout);

			for (const service of services) {
				const shortId = service.id.slice(0, 8);
				const status = service.status ?? "unknown";
				let coloredStatus;
				if (status === "deployed") {
					coloredStatus = chalk.green(status);
				} else if (status === "deploying") {
					coloredStatus = chalk.yellow(status);
				} else if (
					status === "crashing" ||
					status === "crashed" ||
					status === "failed"
				) {
					coloredStatus = chalk.red(status);
				} else {
					coloredStatus = chalk.dim(status);
				}
				const url = `https://railway.com/project/${projectId}/service/${service.id}`;
				console.log(
					`  ${chalk.bold(service.name)} : ${coloredStatus} (${shortId}) → ${chalk.dim(url)}`,
				);
			}
		} catch (err) {
			console.log(
				`  ${chalk.red("✖")} ${chalk.dim(`Failed to fetch service status: ${err.message}`)}`,
			);
		}
	}

	console.log();
}
