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
	const { cwd = process.cwd(), output = console.log } = options;

	output(chalk.blue.bold("\n🔍 Quark Deploy Inspection\n"));

	// --- Service discovery ---
	output(chalk.cyan("  Project Services\n"));

	const discovery = await discoverQuarkDeployProject(cwd);

	if (discovery.services.length === 0) {
		output(chalk.yellow("  No Quark services discovered."));
	} else {
		for (const service of discovery.services) {
			output(`  ${chalk.bold(service.name)}`);
			output(`    Package:    ${service.packageName ?? chalk.dim("unknown")}`);
			output(`    Root:       ${service.relativeRootDir}`);
			output(`    Entrypoint: ${service.runtime.relativeEntrypoint}`);
			if (service.runtime.healthcheckPath) {
				output(`    Health:     ${service.runtime.healthcheckPath}`);
			}
			output(
				`    Required:   ${service.required ? chalk.green("yes") : chalk.dim("no")}`,
			);
			output();
		}
	}

	// --- Diagnostics ---
	if (discovery.diagnostics.length > 0) {
		output(chalk.yellow("  Diagnostics\n"));
		for (const diagnostic of discovery.diagnostics) {
			output(`  ${chalk.yellow("⚠")} ${diagnostic.message}`);
		}
		output();
	}

	// --- Railway readiness ---
	output(chalk.cyan("  Railway Readiness\n"));

	const railCLIVersion = await checkRailwayCLI();
	output(`  CLI installed:  ${formatBool(!!railCLIVersion)}`);
	if (railCLIVersion) {
		output(`    Version:       ${railCLIVersion}`);
	}

	const railUser = await checkRailwayLogin();
	output(`  Logged in:      ${formatBool(!!railUser)}`);
	if (railUser) {
		output(`    User:          ${railUser}`);
	}

	const linked = await isProjectLinked(cwd);
	output(`  Project linked: ${formatBool(linked)}`);

	if (linked) {
		const domains = await getProjectDomains({ cwd });
		if (domains.length > 0) {
			output(chalk.green("\n  Deployed Services\n"));
			for (const domain of domains) {
				output(
					`    ${domain.service ?? chalk.dim("unknown")}: ${domain.domain ?? chalk.dim("no domain")}`,
				);
			}
		}
	}

	// --- Service Status ---
	if (linked) {
		output(chalk.cyan("  Service Status\n"));

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
				output(
					`  ${chalk.bold(service.name)} : ${coloredStatus} (${shortId}) → ${chalk.dim(url)}`,
				);
			}
		} catch (err) {
			output(
				`  ${chalk.red("✖")} ${chalk.dim(`Failed to fetch service status: ${err.message}`)}`,
			);
		}
	}

	output();
}
