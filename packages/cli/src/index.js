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

			// Step 4: Ask which features to eject
			console.log(chalk.cyan("\n  🎯 Configuring features..."));
			const response = await prompts([
				{
					type: "multiselect",
					name: "features",
					message:
						"Which packages would you like to eject (customize) locally?",
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

			// Step 5: Copy selected templates to packages
			console.log(chalk.cyan("\n  📋 Setting up selected packages..."));

			for (const feature of features) {
				const packageDir = path.join(targetDir, "packages", feature);
				await fs.ensureDir(packageDir);
				await copyTemplate(feature, packageDir);

				// Update package.json with proper scope
				const packageJsonPath = path.join(packageDir, "package.json");
				await updatePackageJsonName(packageJsonPath, scope);

				console.log(chalk.green(`    ✓ ${feature}`));
			}

			// Step 6: Create .env.example file
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
`;
			await fs.writeFile(path.join(targetDir, ".env.example"), envExample);
			console.log(chalk.green(`    ✓ .env.example`));

			// Step 7: Initialize git repository
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
			console.log(chalk.white(`  2. cp .env.example .env`));
			console.log(chalk.white(`  3. pnpm install`));
			console.log(chalk.white(`  4. docker compose up -d`));
			console.log(chalk.white(`  5. pnpm dev\n`));

			console.log(chalk.cyan("Learn more:"));
			console.log(
				chalk.white(
					`  📖 Docs: https://github.com/yourusername/${projectName}`,
				),
			);
			console.log(
				chalk.white(
					`  💬 Issues: https://github.com/yourusername/${projectName}/issues\n`,
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

program.parse();
