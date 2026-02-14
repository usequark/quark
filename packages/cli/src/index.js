#!/usr/bin/env node
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import prompts from "prompts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "../templates");
const pkg = await fs.readJSON(path.join(__dirname, "../package.json"));

const program = new Command();

program
	.name("quark-create-app")
	.description("Scaffold a new project from the Quark monorepo")
	.version(pkg.version);

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the random string (default: 32)
 * @returns {string} Base64 encoded random string
 */
function generateSecureSecret(length = 32) {
	return crypto
		.randomBytes(length)
		.toString("base64")
		.replace(/[/+=]/g, "")
		.substring(0, length);
}

/**
 * Generate a secure random password
 * @param {number} length - Length of the password (default: 24)
 * @returns {string} Alphanumeric password
 */
function generateSecurePassword(length = 24) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
	const bytes = crypto.randomBytes(length);
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars[bytes[i] % chars.length];
	}
	return result;
}

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

/**
 * Replace @bobnoddle/quark-* workspace deps with @scope/* for local packages
 */
function replaceDepsScope(deps, scope) {
	if (!deps) return;
	for (const [key, value] of Object.entries(deps)) {
		if (key.startsWith("@bobnoddle/quark-") && value === "workspace:*") {
			const packageName = key.replace("@bobnoddle/quark-", "");
			delete deps[key];
			deps[`@${scope}/${packageName}`] = value;
		}
	}
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

			// Update app package.json files to use correct scope
			const appPaths = [
				path.join(targetDir, "apps", "web", "package.json"),
				path.join(targetDir, "apps", "worker", "package.json"),
			];

			for (const appPkgPath of appPaths) {
				if (await fs.pathExists(appPkgPath)) {
					const appPkg = await fs.readJSON(appPkgPath);
					replaceDepsScope(appPkg.dependencies, scope);
					replaceDepsScope(appPkg.devDependencies, scope);
					await fs.writeFile(
						appPkgPath,
						`${JSON.stringify(appPkg, null, 2)}\n`,
					);
				}
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
			const envExampleTemplate = `# --- Database Configuration ---
# These map to the service names in docker-compose.yml
# ⚠️  SECURITY WARNING: Change these default passwords in production!
# Generate strong passwords with: openssl rand -base64 32
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=quark_user
POSTGRES_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
POSTGRES_DB=${scope}_dev
# Optional: Set DATABASE_URL to override the dynamic construction above
# DATABASE_URL="postgresql://quark_user:CHANGE_ME_TO_STRONG_PASSWORD@localhost:5432/${scope}_dev?schema=public"

# --- Redis Configuration ---
REDIS_HOST=localhost
REDIS_PORT=6379
# Optional: Set REDIS_URL to override the dynamic construction above
# REDIS_URL="redis://localhost:6379"

# --- Mailhog Configuration ---
MAILHOG_HOST=localhost
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025
# Optional: Set MAILHOG_SMTP_URL to override the dynamic construction above
# MAILHOG_SMTP_URL="smtp://localhost:1025"

# --- Application URL ---
# The canonical URL of your application.
# NEXTAUTH_URL, CORS origins, and other URL-dependent settings are derived from this.
# Development: http://localhost:3000
# Production: https://yourdomain.com
APP_URL=http://localhost:3000

# --- NextAuth Configuration ---
# ⚠️  CRITICAL: Generate a secure secret with: openssl rand -base64 32
# This secret is used to encrypt JWT tokens and session data
NEXTAUTH_SECRET=CHANGE_ME_TO_STRONG_SECRET

# --- OAuth Providers (Optional) ---
# GitHub OAuth - Get credentials at: https://github.com/settings/developers
# GITHUB_ID=your_github_client_id
# GITHUB_SECRET=your_github_client_secret

# Google OAuth - Get credentials at: https://console.cloud.google.com/apis/credentials
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret

# --- Web App Configuration ---
WEB_PORT=3000

# --- Worker Configuration ---
WORKER_CONCURRENCY=5

# --- GitHub Packages Authentication ---
# Required for installing and updating Quark packages from GitHub Packages
# (and for publishing if you're maintaining the Quark framework)
# Generate token at https://github.com/settings/tokens with read:packages scope (and write:packages for publishing)
# GH_TOKEN=github_pat_YOUR_TOKEN_HERE
`;
			await fs.writeFile(
				path.join(targetDir, ".env.example"),
				envExampleTemplate,
			);
			console.log(chalk.green(`    ✓ .env.example`));

			// Step 10: Prompt for GH_TOKEN and generate .env with secure defaults
			console.log(chalk.cyan("\n  🔑 Generating secure environment file..."));
			const tokenResponse = await prompts({
				type: "password",
				name: "githubPat",
				message: "GitHub PAT (read:packages scope, leave blank to skip)",
			});
			const githubPat = (tokenResponse.githubPat || "").trim();

			// Generate secure random values
			const dbPassword = generateSecurePassword(24);
			const nextAuthSecret = generateSecureSecret(32);

			// Create .env with auto-generated secure values
			const envContent = `# --- Database Configuration ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=quark_user
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=${scope}_dev

# --- Redis Configuration ---
REDIS_HOST=localhost
REDIS_PORT=6379

# --- Mailhog Configuration ---
MAILHOG_HOST=localhost
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# --- NextAuth Configuration ---
NEXTAUTH_SECRET=${nextAuthSecret}

# --- Application URL ---
APP_URL=http://localhost:3000

# --- Web App Configuration ---
WEB_PORT=3000

# --- Worker Configuration ---
WORKER_CONCURRENCY=5

# --- GitHub Packages Authentication ---
${githubPat ? `GH_TOKEN=${githubPat}` : "# GH_TOKEN=github_pat_YOUR_TOKEN_HERE"}
`;
			await fs.writeFile(path.join(targetDir, ".env"), envContent);
			console.log(
				chalk.green(`    ✓ .env (with auto-generated secure secrets)`),
			);

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
			console.log(chalk.white(`  📖 Docs: https://github.com/Bobnoddle/quark`));
			console.log(
				chalk.white(`  💬 Issues: https://github.com/Bobnoddle/quark/issues\n`),
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
			let updatedVersion = "updated";
			try {
				const corePkg = await fs.readJSON(
					path.join(
						process.cwd(),
						"node_modules",
						"@bobnoddle",
						"quark-core",
						"package.json",
					),
				);
				updatedVersion = corePkg.version;
			} catch {}
			quarkLink.quarkVersion = updatedVersion;
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
