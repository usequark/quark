#!/usr/bin/env node
import crypto from "node:crypto";
import net from "node:net";
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
 * Check if a TCP port is available on localhost.
 * Uses a connect test (not bind) to reliably detect Docker-bound ports on macOS.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortAvailable(port) {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		socket.setTimeout(500);
		socket.once("connect", () => {
			socket.destroy();
			resolve(false); // something is listening — port is in use
		});
		socket.once("error", () => {
			socket.destroy();
			resolve(true); // ECONNREFUSED — port is free
		});
		socket.once("timeout", () => {
			socket.destroy();
			resolve(true); // no response — port is free
		});
		socket.connect(port, "127.0.0.1");
	});
}

/**
 * Find the next available port starting from a given port
 * @param {number} startPort
 * @param {number} [maxAttempts=20]
 * @returns {Promise<number>}
 */
async function findAvailablePort(startPort, maxAttempts = 20) {
	for (let i = 0; i < maxAttempts; i++) {
		const port = startPort + i;
		if (await isPortAvailable(port)) {
			return port;
		}
	}
	return startPort; // fallback to default if all checked ports are busy
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
	if (Object.keys(variables).length > 0) {
		const packageJsonPath = path.join(targetDir, "package.json");
		if (await fs.pathExists(packageJsonPath)) {
			let content = await fs.readFile(packageJsonPath, "utf-8");

			for (const [key, value] of Object.entries(variables)) {
				const pattern = new RegExp(
					key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
					"g",
				);
				content = content.replace(pattern, value);
			}

			await fs.writeFile(packageJsonPath, content);
		}
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
 * Replace @techstream/quark-* workspace deps with @scope/* for local packages.
 * Also removes deps for packages that were not selected.
 */
function replaceDepsScope(deps, scope, selectedPackages) {
	if (!deps) return;
	for (const [key, value] of Object.entries(deps)) {
		if (key.startsWith("@techstream/quark-") && value === "workspace:*") {
			const packageName = key.replace("@techstream/quark-", "");
			delete deps[key];
			// Only keep the dep if the package was selected (or is always required)
			if (
				packageName === "db" ||
				packageName === "config" ||
				selectedPackages.includes(packageName)
			) {
				deps[`@${scope}/${packageName}`] = value;
			}
		}
	}
}

/**
 * Replace @techstream/quark-* import paths in all .js source files
 * for workspace packages (db, jobs, ui, config) with @scope/* equivalents.
 * Registry packages (@techstream/quark-core) are left untouched.
 */
async function replaceImportsInSourceFiles(dir, scope) {
	const workspacePackages = ["db", "jobs", "ui", "config"];
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (
			entry.isDirectory() &&
			entry.name !== "node_modules" &&
			entry.name !== ".next"
		) {
			await replaceImportsInSourceFiles(fullPath, scope);
		} else if (entry.isFile() && /\.(js|ts|jsx|tsx|mjs)$/.test(entry.name)) {
			let content = await fs.readFile(fullPath, "utf-8");
			let changed = false;

			for (const pkg of workspacePackages) {
				const pattern = new RegExp(`@techstream/quark-${pkg}`, "g");
				if (pattern.test(content)) {
					content = content.replace(pattern, `@${scope}/${pkg}`);
					changed = true;
				}
			}

			if (changed) {
				await fs.writeFile(fullPath, content);
			}
		}
	}
}

/**
 * Validate project name to prevent path traversal and ensure safe directory creation
 */
function validateProjectName(name) {
	if (!name || typeof name !== "string") {
		throw new Error("Project name is required");
	}
	// Only allow safe characters: alphanumeric, hyphens, underscores, dots
	if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
		throw new Error(
			"Project name may only contain letters, numbers, hyphens, underscores, and dots",
		);
	}
	// Block path traversal patterns
	if (name.startsWith(".") || name.includes("..")) {
		throw new Error("Project name must not start with '.' or contain '..'");
	}

	const resolved = path.resolve(process.cwd(), name);
	if (!resolved.startsWith(process.cwd())) {
		throw new Error("Project name must not escape the current directory");
	}

	return resolved;
}

program
	.argument("<project-name>", "Name of the project to create")
	.action(async (projectName) => {
		console.log(
			chalk.blue.bold(
				`\n\uD83D\uDE80 Creating your new Quark project: ${projectName}\n`,
			),
		);

		const targetDir = validateProjectName(projectName);
		const scope = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "");

		// Check if directory already exists
		if (await fs.pathExists(targetDir)) {
			const { overwrite } = await prompts({
				type: "confirm",
				name: "overwrite",
				message: `Directory "${projectName}" already exists. Remove it and recreate?`,
				initial: false,
			});

			if (!overwrite) {
				console.log(chalk.yellow("Aborted."));
				process.exit(1);
			}

			// Clean up Docker resources (volumes hold old credentials)
			try {
				await execa("docker", ["compose", "down", "-v"], {
					cwd: targetDir,
					stdio: "ignore",
				});
				console.log(chalk.green("  ✓ Cleaned up Docker volumes"));
			} catch {
				// No docker-compose file or Docker not running — fine
			}

			await fs.remove(targetDir);
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

			// Database and config packages are always required
			const requiredPackages = ["db", "config"];
			for (const reqPkg of requiredPackages) {
				const pkgDir = path.join(targetDir, "packages", reqPkg);
				// db is already copied from base-project; config needs to be copied from its template
				if (!(await fs.pathExists(pkgDir))) {
					await fs.ensureDir(pkgDir);
					await copyTemplate(reqPkg, pkgDir);
				}
				const pkgJsonPath = path.join(pkgDir, "package.json");
				const pkgJson = await fs.readJSON(pkgJsonPath);
				pkgJson.name = `@${scope}/${reqPkg}`;
				await fs.writeFile(
					pkgJsonPath,
					`${JSON.stringify(pkgJson, null, 2)}\n`,
				);
				console.log(chalk.green(`    ✓ ${reqPkg} (required)`));
			}

			// Step 5: Ask which optional features to eject
			console.log(chalk.cyan("\n  🎯 Configuring optional features...\n"));
			const response = await prompts([
				{
					type: "multiselect",
					name: "features",
					message: "Which optional packages would you like to include?",
					instructions: false,
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
					],
				},
			]);

			const { features } = response;

			// Handle prompt cancellation (Ctrl+C)
			if (!features) {
				console.log(chalk.yellow("\n\u26A0\uFE0F  Setup cancelled."));
				await fs.remove(targetDir);
				process.exit(0);
			}

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

			// Step 7: Update all package.json dependencies to use correct scope
			console.log(chalk.cyan("\n  🔧 Updating app dependencies..."));

			// Collect all package.json files that need scope replacement (apps + packages)
			const allPkgPaths = [
				path.join(targetDir, "apps", "web", "package.json"),
				path.join(targetDir, "apps", "worker", "package.json"),
				// Also update cross-dependencies in scaffolded packages (e.g. db → config)
				...["db", ...features].map((pkg) =>
					path.join(targetDir, "packages", pkg, "package.json"),
				),
			];

			for (const pkgPath of allPkgPaths) {
				if (await fs.pathExists(pkgPath)) {
					const pkg = await fs.readJSON(pkgPath);
					// Rename package name if it uses @quark/ prefix
					if (pkg.name?.startsWith("@quark/")) {
						const shortName = pkg.name.replace("@quark/", "");
						pkg.name = `@${scope}/${shortName}`;
					}
					replaceDepsScope(pkg.dependencies, scope, features);
					replaceDepsScope(pkg.devDependencies, scope, features);
					await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
				}
			}

			// Also rename root package.json
			const rootPkgPath = path.join(targetDir, "package.json");
			if (await fs.pathExists(rootPkgPath)) {
				const rootPkg = await fs.readJSON(rootPkgPath);
				rootPkg.name = `@${scope}/root`;
				await fs.writeFile(
					rootPkgPath,
					`${JSON.stringify(rootPkg, null, 2)}\n`,
				);
			}

			console.log(chalk.green(`    ✓ App dependencies updated`));

			// Step 7b: Replace workspace package imports in source files
			console.log(chalk.cyan("\n  🔄 Updating import paths..."));
			await replaceImportsInSourceFiles(targetDir, scope);
			console.log(chalk.green(`    ✓ Import paths updated`));

			// Step 8: Create .env.example file
			console.log(chalk.cyan("\n  📋 Creating environment configuration..."));
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

# --- Mail Configuration (Mailpit in development) ---
MAIL_HOST=localhost
MAIL_SMTP_PORT=1025
MAIL_UI_PORT=8025
# Optional: Set MAIL_SMTP_URL to override the dynamic construction above
# MAIL_SMTP_URL="smtp://localhost:1025"

# --- Application URL ---
# In development, APP_URL is derived automatically from PORT — no need to set it.
# In production, set this to your real domain:
# APP_URL=https://yourdomain.com

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
PORT=3000

# --- Worker Configuration ---
WORKER_CONCURRENCY=5

# --- File Storage Configuration ---
# Storage provider: "local" (default) or "s3" (S3-compatible, e.g. Cloudflare R2)
STORAGE_PROVIDER=local
# Local storage directory (only used when STORAGE_PROVIDER=local)
# STORAGE_LOCAL_DIR=./uploads

# S3 / Cloudflare R2 Configuration (only used when STORAGE_PROVIDER=s3)
# S3_BUCKET=your-bucket-name
# S3_REGION=auto
# S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# S3_ACCESS_KEY_ID=your-access-key
# S3_SECRET_ACCESS_KEY=your-secret-key
# S3_PUBLIC_URL=https://your-public-bucket-domain.com

# --- Upload Limits ---
# UPLOAD_MAX_SIZE=10485760
# UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml,application/pdf
`;
			await fs.writeFile(
				path.join(targetDir, ".env.example"),
				envExampleTemplate,
			);
			console.log(chalk.green(`    ✓ .env.example`));

			// Step 9: Find available ports and generate .env
			console.log(chalk.cyan("\n  🔌 Checking port availability..."));
			const postgresPort = await findAvailablePort(5432);
			const redisPort = await findAvailablePort(6379);
			const mailSmtpPort = await findAvailablePort(1025);
			const mailUiPort = await findAvailablePort(8025);
			const webPort = await findAvailablePort(3000);

			const portChanges = [];
			if (postgresPort !== 5432)
				portChanges.push(`PostgreSQL: ${postgresPort}`);
			if (redisPort !== 6379) portChanges.push(`Redis: ${redisPort}`);
			if (mailSmtpPort !== 1025) portChanges.push(`Mail SMTP: ${mailSmtpPort}`);
			if (mailUiPort !== 8025) portChanges.push(`Mail UI: ${mailUiPort}`);
			if (webPort !== 3000) portChanges.push(`Web: ${webPort}`);

			if (portChanges.length > 0) {
				console.log(chalk.yellow(`    ⚡ Ports adjusted to avoid conflicts:`));
				for (const change of portChanges) {
					console.log(chalk.yellow(`      • ${change}`));
				}
			} else {
				console.log(chalk.green(`    ✓ All default ports available`));
			}

			console.log(chalk.cyan("\n  🔑 Generating secure environment file..."));

			// Generate secure random values
			const dbPassword = generateSecurePassword(24);
			const nextAuthSecret = generateSecureSecret(32);

			// Create .env with auto-generated secure values
			const envContent = `# --- Database Configuration ---
POSTGRES_HOST=localhost
POSTGRES_PORT=${postgresPort}
POSTGRES_USER=quark_user
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=${scope}_dev

# --- Redis Configuration ---
REDIS_HOST=localhost
REDIS_PORT=${redisPort}

# --- Mail Configuration ---
MAIL_HOST=localhost
MAIL_SMTP_PORT=${mailSmtpPort}
MAIL_UI_PORT=${mailUiPort}

# --- NextAuth Configuration ---
NEXTAUTH_SECRET=${nextAuthSecret}

# --- Web App Configuration ---
# APP_URL is derived from PORT automatically in development.
# In production, set APP_URL explicitly in your environment.
PORT=${webPort}

# --- Worker Configuration ---
WORKER_CONCURRENCY=5

# --- File Storage ---
STORAGE_PROVIDER=local
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
				requiredPackages: ["db", "config"],
				packages: features,
			};
			await fs.writeFile(
				path.join(targetDir, ".quark-link.json"),
				JSON.stringify(quarkLinkJson, null, 2),
			);
			console.log(chalk.green(`    ✓ .quark-link.json`));

			// Step 11: Initialize git repository
			console.log(chalk.cyan("\n  📝 Initializing git repository..."));
			const gitInitialized = await initializeGit(targetDir);
			if (gitInitialized) {
				console.log(chalk.green(`    ✓ Git initialized with initial commit`));
			}

			// Step 12: Run pnpm install
			console.log(chalk.cyan("\n  📦 Installing dependencies..."));
			try {
				await execa("pnpm", ["install"], {
					cwd: targetDir,
					stdio: "inherit",
				});
				console.log(chalk.green(`\n    ✓ Dependencies installed`));
			} catch (installError) {
				console.warn(
					chalk.yellow(`\n    ⚠️  pnpm install failed: ${installError.message}`),
				);
				console.warn(
					chalk.yellow(
						`    Run 'pnpm install' manually after resolving the issue.`,
					),
				);
			}

			// Step 13: Generate Prisma client
			console.log(chalk.cyan("\n  🗄️  Generating Prisma client..."));
			try {
				await execa("pnpm", ["--filter", "db", "db:generate"], {
					cwd: targetDir,
					stdio: "inherit",
				});
				console.log(chalk.green(`    ✓ Prisma client generated`));
			} catch (generateError) {
				console.warn(
					chalk.yellow(
						`\n    ⚠️  Prisma generate failed: ${generateError.message}`,
					),
				);
				console.warn(
					chalk.yellow(`    Run 'pnpm --filter db db:generate' manually.`),
				);
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
			console.log(chalk.white(`  2. docker compose up -d`));
			console.log(chalk.white(`  3. pnpm db:migrate`));
			console.log(chalk.white(`  4. pnpm dev\n`));

			console.log(chalk.cyan("Important:"));
			console.log(
				chalk.white(
					`  • Update Quark core with: pnpm update @techstream/quark-core`,
				),
			);
			console.log(
				chalk.white(`  • Or run: npx @techstream/quark-create-app update\n`),
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
				chalk.white("Run 'pnpm update @techstream/quark-*' to apply updates."),
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
			await execa("pnpm", ["update", "@techstream/quark-core"], {
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
						"@techstream",
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
				chalk.cyan("Note: This updates @techstream/quark-core only.\n"),
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
