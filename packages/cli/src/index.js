#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import prompts from "prompts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "../templates");

const program = new Command();

program
	.name("quark-create-app")
	.description("Scaffold a new project from the Quark monorepo")
	.version("1.0.0");

/**
 * Copy a template directory to the target location, with variable substitution
 */
async function copyTemplate(templateName, targetDir, variables = {}) {
	const templatePath = path.join(templatesDir, templateName);

	if (!(await fs.pathExists(templatePath))) {
		throw new Error(`Template not found: ${templateName}`);
	}

	// Copy the template
	await fs.copy(templatePath, targetDir);

	// Replace variables in package.json files
	const packageJsonPath = path.join(targetDir, "package.json");
	if (await fs.pathExists(packageJsonPath)) {
		let content = await fs.readFile(packageJsonPath, "utf-8");

		for (const [_key, value] of Object.entries(variables)) {
			content = content.replace(/@myquark/g, value);
		}

		await fs.writeFile(packageJsonPath, content);
	}
}

/**
 * Initialize a git repository and create an initial commit
 */
async function initializeGit(projectDir) {
	try {
		// Initialize git repo
		await execa("git", ["init"], { cwd: projectDir });

		// Set git config for the repo (optional but good practice)
		await execa("git", ["config", "user.email", "you@example.com"], {
			cwd: projectDir,
		});
		await execa("git", ["config", "user.name", "Your Name"], {
			cwd: projectDir,
		});

		// Add all files
		await execa("git", ["add", "."], { cwd: projectDir });

		// Create initial commit
		await execa(
			"git",
			["commit", "-m", "Initial commit: Quark project scaffold"],
			{
				cwd: projectDir,
			},
		);

		return true;
	} catch (error) {
		console.warn(
			chalk.yellow(`⚠️  Git initialization failed: ${error.message}`),
		);
		return false;
	}
}

/**
 * Update package.json name with scope
 */
async function updatePackageJsonName(filePath, scope) {
	const content = await fs.readFile(filePath, "utf-8");
	const packageJson = JSON.parse(content);

	// Extract package name (e.g., "@myquark/ui" -> "ui")
	const parts = packageJson.name.split("/");
	const packageName = parts[parts.length - 1];

	packageJson.name = `@${scope}/${packageName}`;

	await fs.writeFile(filePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

program
	.argument("<project-name>", "Name of the project to create")
	.action(async (projectName) => {
		console.log(
			chalk.blue.bold(`\n🚀 Creating your new Quark project: ${projectName}\n`),
		);

		const targetDir = path.join(process.cwd(), projectName);
		const scope = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "");

		// Check if directory already exists
		if (await fs.pathExists(targetDir)) {
			console.error(chalk.red(`✗ Directory already exists: ${targetDir}`));
			process.exit(1);
		}

		try {
			// Create the base directory
			await fs.ensureDir(targetDir);

			// Step 1: Copy base project template
			console.log(chalk.cyan("  📦 Scaffolding base project structure..."));
			await copyTemplate("base-project", targetDir, {
				"@myquark": `@${scope}`,
			});

			// Step 2: Create apps directory
			await fs.ensureDir(path.join(targetDir, "apps"));

			// Step 3: Create packages directory
			await fs.ensureDir(path.join(targetDir, "packages"));

			// Step 4: Copy required packages (always included)
			console.log(chalk.cyan("\n  📦 Setting up required packages..."));

			// Database package is always required (already copied from base-project)
			// Just update its package.json name
			const dbPackageDir = path.join(targetDir, "packages", "db");
			const dbPackageJsonPath = path.join(dbPackageDir, "package.json");
			const dbPackageJson = await fs.readJSON(dbPackageJsonPath);
			dbPackageJson.name = `@${scope}/db`;
			await fs.writeFile(
				dbPackageJsonPath,
				`${JSON.stringify(dbPackageJson, null, 2)}\n`,
			);
			console.log(chalk.green(`    ✓ db (required)`));

			// Step 5: Ask which optional features to eject
			console.log(chalk.cyan("\n  🎯 Configuring optional features..."));
			const response = await prompts([
				{
					type: "multiselect",
					name: "features",
					message: "Which optional packages would you like to include?",
					choices: [
						{
							title: "UI Components (packages/ui)",
							value: "ui",
							selected: true,
						},
						{
							title: "Job Definitions (packages/jobs)",
							value: "jobs",
							selected: true,
						},
						{
							title: "Configuration (packages/config)",
							value: "config",
							selected: false,
						},
					],
				},
			]);

			const { features } = response;

			// Step 6: Copy selected optional packages
			if (features.length > 0) {
				console.log(chalk.cyan("\n  📋 Setting up optional packages..."));

				for (const feature of features) {
					const packageDir = path.join(targetDir, "packages", feature);
					await fs.ensureDir(packageDir);
					await copyTemplate(feature, packageDir);

					// Update package.json with proper scope
					const packageJsonPath = path.join(packageDir, "package.json");
					await updatePackageJsonName(packageJsonPath, scope);

					console.log(chalk.green(`    ✓ ${feature}`));
				}
			}

			// Step 7: Update app dependencies to use correct scope
			console.log(chalk.cyan("\n  🔧 Updating app dependencies..."));

			// Update web app package.json
			const webPackageJsonPath = path.join(
				targetDir,
				"apps",
				"web",
				"package.json",
			);
			if (await fs.pathExists(webPackageJsonPath)) {
				const webPackageJson = await fs.readJSON(webPackageJsonPath);

				// Replace @bobnoddle/quark-* with @scope/* for local packages
				const replaceScope = (deps) => {
					if (!deps) return;
					for (const [key, value] of Object.entries(deps)) {
						if (
							key.startsWith("@bobnoddle/quark-") &&
							value === "workspace:*"
						) {
							const packageName = key.replace("@bobnoddle/quark-", "");
							delete deps[key];
							deps[`@${scope}/${packageName}`] = value;
						}
					}
				};

				replaceScope(webPackageJson.dependencies);
				replaceScope(webPackageJson.devDependencies);

				await fs.writeFile(
					webPackageJsonPath,
					`${JSON.stringify(webPackageJson, null, 2)}\n`,
				);
			}

			// Update worker app package.json
			const workerPackageJsonPath = path.join(
				targetDir,
				"apps",
				"worker",
				"package.json",
			);
			if (await fs.pathExists(workerPackageJsonPath)) {
				const workerPackageJson = await fs.readJSON(workerPackageJsonPath);

				const replaceScope = (deps) => {
					if (!deps) return;
					for (const [key, value] of Object.entries(deps)) {
						if (
							key.startsWith("@bobnoddle/quark-") &&
							value === "workspace:*"
						) {
							const packageName = key.replace("@bobnoddle/quark-", "");
							delete deps[key];
							deps[`@${scope}/${packageName}`] = value;
						}
					}
				};

				replaceScope(workerPackageJson.dependencies);
				replaceScope(workerPackageJson.devDependencies);

				await fs.writeFile(
					workerPackageJsonPath,
					`${JSON.stringify(workerPackageJson, null, 2)}\n`,
				);
			}

			console.log(chalk.green(`    ✓ App dependencies updated`));

			// Step 8: Create .npmrc for GitHub Packages (repo-local)
			console.log(
				chalk.cyan("\n  🔐 Creating GitHub Packages configuration..."),
			);
			const npmrc = `@bobnoddle:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GH_TOKEN}
`;
			await fs.writeFile(path.join(targetDir, ".npmrc"), npmrc);
			console.log(chalk.green(`    ✓ .npmrc`));

			// Step 9: Create .env.example file
			console.log(chalk.cyan("\n  🔐 Creating environment configuration..."));
			const envExample = `# Database
POSTGRES_USER=quark
POSTGRES_PASSWORD=development
POSTGRES_DB=${scope}_dev
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Email
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# Application
NODE_ENV=development
API_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://quark:development@localhost:5432/${scope}_dev
REDIS_URL=redis://localhost:6379
EMAIL_FROM=noreply@${scope}.com

# GitHub Packages Authentication (required for Quark package installation)
# Generate Personal Access Token at https://github.com/settings/tokens with:
#   - read:packages (to download packages)
#   - write:packages (if publishing)
# Set this BEFORE running pnpm install
GH_TOKEN=YOUR_PAT_HERE
`;
			await fs.writeFile(path.join(targetDir, ".env.example"), envExample);
			console.log(chalk.green(`    ✓ .env.example`));

			// Step 10: Prompt for GH_TOKEN and write .env
			const tokenResponse = await prompts({
				type: "password",
				name: "githubPat",
				message: "GitHub PAT (read:packages scope, leave blank to skip)",
			});
			const githubPat = (tokenResponse.githubPat || "").trim();
			const envContent = githubPat
				? envExample.replace("GH_TOKEN=YOUR_PAT_HERE", `GH_TOKEN=${githubPat}`)
				: envExample;
			await fs.writeFile(path.join(targetDir, ".env"), envContent);
			console.log(chalk.green(`    ✓ .env`));

			// Step 11: Create .quark-link.json to track Quark version
			const quarkLinkJson = {
				quarkVersion: process.env.QUARK_VERSION || "latest",
				quarkSourcePath: process.env.QUARK_SOURCE_PATH || "../../quark",
				scaffoldedDate: new Date().toISOString(),
				requiredPackages: ["db"],
				packages: features,
			};
			await fs.writeFile(
				path.join(targetDir, ".quark-link.json"),
				JSON.stringify(quarkLinkJson, null, 2),
			);
			console.log(chalk.green(`    ✓ .quark-link.json`));

			// Step 12: Initialize git repository
			console.log(chalk.cyan("\n  📝 Initializing git repository..."));
			const gitInitialized = await initializeGit(targetDir);
			if (gitInitialized) {
				console.log(chalk.green(`    ✓ Git initialized with initial commit`));
			}

			// Success message
			console.log(
				chalk.green.bold(
					`\n✅ Project "${projectName}" created successfully!\n`,
				),
			);

			console.log(chalk.white(`📂 Project location: ${targetDir}\n`));
			console.log(chalk.cyan("Next steps:"));
			console.log(chalk.white(`  1. cd ${projectName}`));
			console.log(
				chalk.white(
					`  2. If you skipped the token prompt, add GH_TOKEN to .env`,
				),
			);
			console.log(chalk.white(`  3. npx dotenv-cli -e .env -- pnpm install`));
			console.log(chalk.white(`  4. docker compose up -d`));
			console.log(chalk.white(`  5. pnpm dev\n`));

			console.log(chalk.cyan("Important:"));
			console.log(
				chalk.white(
					`  • .npmrc and .quark-link.json are auto-generated for GitHub Packages`,
				),
			);
			console.log(
				chalk.white(
					`  • If you skipped the token prompt, add GH_TOKEN to .env before installing`,
				),
			);
			console.log(
				chalk.white(`  • Run 'npx dotenv-cli -e .env -- pnpm install'`),
			);
			console.log(
				chalk.white(`  • Use 'quark-update' to upgrade Quark packages\n`),
			);

			console.log(chalk.cyan("Learn more:"));
			console.log(
				chalk.white(`  📖 Docs: https://github.com/Bobnoddle/${projectName}`),
			);
			console.log(
				chalk.white(
					`  💬 Issues: https://github.com/Bobnoddle/${projectName}/issues\n`,
				),
			);
		} catch (error) {
			console.error(chalk.red(`\n✗ Error creating project: ${error.message}`));
			console.error(chalk.dim(error.stack));

			// Clean up on error
			if (await fs.pathExists(targetDir)) {
				await fs.remove(targetDir);
			}

			process.exit(1);
		}
	});

/**
 * quark-update command
 * Updates Quark core infrastructure in a scaffolded project
 */
program
	.command("update")
	.description("Update Quark core infrastructure in the current project")
	.option("--check", "Check for updates without applying")
	.option("--force", "Skip safety checks")
	.action(async (options) => {
		console.log(chalk.blue.bold(`\n🔄 Quark Package Update\n`));

		// Check if .quark-link.json exists
		const quarkLinkPath = path.join(process.cwd(), ".quark-link.json");
		if (!(await fs.pathExists(quarkLinkPath))) {
			console.error(
				chalk.red("✗ .quark-link.json not found. Are you in a Quark project?"),
			);
			process.exit(1);
		}

		const quarkLink = await fs.readJSON(quarkLinkPath);
		console.log(chalk.cyan(`Current Quark version: ${quarkLink.quarkVersion}`));
		console.log(chalk.cyan(`Scaffolded: ${quarkLink.scaffoldedDate}\n`));

		if (options.check) {
			console.log(chalk.yellow("Checking for updates..."));
			console.log(
				chalk.white("Run 'pnpm update @bobnoddle/quark-*' to apply updates."),
			);
			return;
		}

		try {
			// Warn if git has uncommitted changes
			if (!options.force) {
				console.log(chalk.yellow("⚠️  Checking for uncommitted changes..."));
				try {
					await execa("git", ["diff", "--exit-code"], {
						cwd: process.cwd(),
					});
				} catch {
					console.log(
						chalk.yellow(
							"⚠️  You have uncommitted changes. Commit or stash them first.",
						),
					);
					console.log(
						chalk.white("Use --force to skip this check (not recommended).\n"),
					);
					process.exit(1);
				}
			}

			// Run pnpm update
			console.log(chalk.cyan("\n📦 Updating Quark core infrastructure...\n"));
			console.log(
				chalk.yellow("💡 Tip: Make sure GH_TOKEN is set in environment\n"),
			);
			console.log(
				chalk.gray(
					"   macOS/Linux: source .env && pnpm update @bobnoddle/quark-core",
				),
			);
			console.log(
				chalk.gray(
					"   Windows: npx dotenv-cli -e .env -- pnpm update @bobnoddle/quark-core\n",
				),
			);
			await execa("pnpm", ["update", "@bobnoddle/quark-core"], {
				cwd: process.cwd(),
				stdio: "inherit",
			});

			// Update .quark-link.json
			quarkLink.quarkVersion = "updated";
			quarkLink.updatedDate = new Date().toISOString();
			await fs.writeFile(quarkLinkPath, JSON.stringify(quarkLink, null, 2));

			console.log(
				chalk.green("\n✅ Quark core infrastructure updated successfully!\n"),
			);
			console.log(
				chalk.cyan("Note: This updates @bobnoddle/quark-core only.\n"),
			);
			console.log(chalk.cyan("Next steps:"));
			console.log(chalk.white(`  1. pnpm install (if prompted)`));
			console.log(chalk.white(`  2. pnpm lint`));
			console.log(chalk.white(`  3. pnpm test`));
			console.log(
				chalk.white(`  4. git add . && git commit -m "chore: update Quark"\n`),
			);
		} catch (error) {
			console.error(chalk.red(`\n✗ Update failed: ${error.message}\n`));
			process.exit(1);
		}
	});

program.parse();
