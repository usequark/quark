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
import { formatProjectDisplayName } from "./utils.js";

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
 * Remove unselected optional feature entries from next.config.js transpilePackages.
 * Must run AFTER replaceImportsInSourceFiles so package names are already scoped.
 */
async function patchNextConfig(webDir, scope, selectedFeatures) {
	const configPath = path.join(webDir, "next.config.js");
	if (!(await fs.pathExists(configPath))) return;

	let content = await fs.readFile(configPath, "utf-8");

	const optionalEntries = {
		ui: `@${scope}/ui`,
		jobs: `@${scope}/jobs`,
		admin: `@${scope}/admin`,
	};

	for (const [feature, pkg] of Object.entries(optionalEntries)) {
		if (!selectedFeatures.includes(feature)) {
			// Remove the line containing this package from transpilePackages
			content = content.replace(
				new RegExp(`[ \\t]*"${pkg.replace("/", "\\/")}",?\\n`, "g"),
				"",
			);
		}
	}

	await fs.writeFile(configPath, content);
}

/**
 * Replace @techstream/quark-* import paths in all .js source files
 * for workspace packages (db, jobs, ui, config) with @scope/* equivalents.
 * Registry packages (@techstream/quark-core) are left untouched.
 */
async function replaceImportsInSourceFiles(dir, scope) {
	const workspacePackages = ["db", "jobs", "ui", "config", "admin"];
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
	.option(
		"--no-prompts",
		"Skip interactive prompts and use default/provided values",
	)
	.option(
		"--features <features>",
		"Comma-separated list of optional features to include (ui,jobs,admin)",
	)
	.option("--skip-install", "Skip pnpm install and Prisma generate steps")
	.option("--skip-docker", "Skip Docker orphan-volume cleanup")
	.action(async (projectName, options) => {
		console.log(
			chalk.blue.bold(
				`\n\uD83D\uDE80 Creating your new Quark project: ${projectName}\n`,
			),
		);

		const targetDir = validateProjectName(projectName);
		const scope = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "");
		const appDisplayName = formatProjectDisplayName(projectName);
		const appDescription = `${appDisplayName} application`;

		// Clean up orphaned Docker volumes from a previous project with the same name.
		// Docker Compose names volumes as "<project>_postgres_data", "<project>_redis_data".
		// These persist even if the project directory is manually deleted, causing
		// authentication failures when the new project generates different credentials.
		// We also need to stop any running containers that reference these volumes.
		if (!options.skipDocker)
			try {
				const volumePrefix = `${projectName}_`;
				const { stdout } = await execa("docker", [
					"volume",
					"ls",
					"--filter",
					`name=${volumePrefix}`,
					"--format",
					"{{.Name}}",
				]);
				const orphanedVolumes = stdout
					.split("\n")
					.filter((v) => v.startsWith(volumePrefix));
				if (orphanedVolumes.length > 0) {
					// Stop and remove any containers using these volumes first
					const { stdout: containerOut } = await execa("docker", [
						"ps",
						"-a",
						"--filter",
						`name=${projectName}`,
						"--format",
						"{{.ID}}",
					]);
					const containers = containerOut.split("\n").filter(Boolean);
					if (containers.length > 0) {
						await execa("docker", ["rm", "-f", ...containers]);
					}
					// Remove the Docker network if it exists
					try {
						await execa("docker", ["network", "rm", `${projectName}_default`]);
					} catch {
						// Network may not exist — fine
					}
					// Now remove the orphaned volumes
					for (const vol of orphanedVolumes) {
						await execa("docker", ["volume", "rm", "-f", vol]);
					}
					console.log(chalk.green("  ✓ Cleaned up orphaned Docker volumes"));
				}
			} catch {
				// Docker not available — fine
			}

		// Check if directory already exists
		if (await fs.pathExists(targetDir)) {
			if (!options.prompts) {
				// In non-interactive mode, automatically remove existing directory
				console.log(
					chalk.yellow(
						`  Directory "${projectName}" already exists. Removing... (non-interactive mode)`,
					),
				);
			} else {
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
			}

			// Stop any running Docker containers for this project
			try {
				await execa("docker", ["compose", "down"], {
					cwd: targetDir,
					stdio: "ignore",
				});
				console.log(chalk.green("  ✓ Stopped existing Docker containers"));
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
			let features;
			if (!options.prompts && options.features) {
				// Parse features from CLI flag
				console.log(chalk.cyan("\n  🎯 Configuring optional features..."));
				const validFeatures = ["ui", "jobs", "admin"];
				features = options.features
					.split(",")
					.map((f) => f.trim())
					.filter((f) => f.length > 0);

				// Validate features
				const invalidFeatures = features.filter(
					(f) => !validFeatures.includes(f),
				);
				if (invalidFeatures.length > 0) {
					throw new Error(
						`Invalid features: ${invalidFeatures.join(", ")}. Valid options are: ${validFeatures.join(", ")}`,
					);
				}

				// Enforce admin dependencies: admin requires ui
				if (features.includes("admin") && !features.includes("ui")) {
					features.push("ui");
				}

				console.log(
					chalk.green(
						`  Selected features: ${features.join(", ") || "none"} (non-interactive mode)`,
					),
				);
			} else if (!options.prompts) {
				// Use defaults when --no-prompts is set without --features
				console.log(chalk.cyan("\n  🎯 Configuring optional features..."));
				features = ["ui", "jobs"]; // Default to ui + jobs (not admin)
				console.log(
					chalk.green(
						`  Using default features: ${features.join(", ")} (non-interactive mode)`,
					),
				);
			} else {
				// Interactive prompt
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
								title: "Background Jobs (packages/jobs + apps/worker)",
								value: "jobs",
								selected: true,
							},
							{
								title: "Admin Dashboard (packages/admin) [requires: ui]",
								value: "admin",
								selected: false,
							},
						],
					},
				]);

				features = response.features;

				// Handle prompt cancellation (Ctrl+C)
				if (!features) {
					console.log(chalk.yellow("\n\u26A0\uFE0F  Setup cancelled."));
					await fs.remove(targetDir);
					process.exit(0);
				}

				// Enforce admin dependencies: admin requires ui
				if (features.includes("admin") && !features.includes("ui")) {
					features.push("ui");
					console.log(
						chalk.yellow("    ℹ  Admin requires UI — automatically included."),
					);
				}
			}

			// Step 6: Copy selected optional packages
			if (features.length > 0) {
				console.log(chalk.cyan("\n  📋 Setting up optional packages..."));

				for (const feature of features) {
					// admin is a package template — skip if no template exists yet
					const templatePath = path.join(templatesDir, feature);
					if (!(await fs.pathExists(templatePath))) {
						console.log(
							chalk.yellow(
								`    ⚠ ${feature} (template not yet available — skipped)`,
							),
						);
						continue;
					}

					const packageDir = path.join(targetDir, "packages", feature);
					await fs.ensureDir(packageDir);
					await copyTemplate(feature, packageDir);

					// Update package.json with proper scope
					const packageJsonPath = path.join(packageDir, "package.json");
					await updatePackageJsonName(packageJsonPath, scope);

					console.log(chalk.green(`    ✓ ${feature}`));
				}

				// If jobs selected, also scaffold apps/worker from its template
				if (features.includes("jobs")) {
					const workerDir = path.join(targetDir, "apps", "worker");
					await fs.ensureDir(workerDir);
					await copyTemplate("worker", workerDir);
					console.log(chalk.green(`    ✓ worker (paired with jobs)`));
				}

				// If admin selected, also scaffold admin routes into apps/web/src/app/admin
				if (features.includes("admin")) {
					const adminRoutesTemplatePath = path.join(
						templatesDir,
						"admin-routes",
					);
					if (await fs.pathExists(adminRoutesTemplatePath)) {
						const adminRoutesDir = path.join(
							targetDir,
							"apps",
							"web",
							"src",
							"app",
							"admin",
						);
						await fs.ensureDir(adminRoutesDir);
						await copyTemplate("admin-routes", adminRoutesDir);
						console.log(chalk.green(`    ✓ admin routes (paired with admin)`));
					}
				}
			}

			// Step 7: Update all package.json dependencies to use correct scope
			console.log(chalk.cyan("\n  🔧 Updating app dependencies..."));

			// Collect all package.json files that need scope replacement (apps + packages)
			const allPkgPaths = [
				path.join(targetDir, "apps", "web", "package.json"),
				// Worker is only present when jobs is selected
				...(features.includes("jobs")
					? [path.join(targetDir, "apps", "worker", "package.json")]
					: []),
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

			// Step 7c: Patch next.config.js to remove unselected feature transpilePackages entries
			await patchNextConfig(
				path.join(targetDir, "apps", "web"),
				scope,
				features,
			);
			console.log(chalk.green(`    ✓ next.config.js patched`));

			// Step 7d: Strip jobs-related code from register route when jobs not selected
			if (!features.includes("jobs")) {
				const registerPath = path.join(
					targetDir,
					"apps",
					"web",
					"src",
					"app",
					"api",
					"auth",
					"register",
					"route.js",
				);
				if (await fs.pathExists(registerPath)) {
					let content = await fs.readFile(registerPath, "utf-8");
					// Remove the jobs import line
					content = content.replace(
						/import\s*\{[^}]*\}\s*from\s*["']@[^/]+\/jobs["'];?\n/,
						"",
					);
					// Remove createQueue from the core import if present
					content = content.replace(/\tcreateQueue,\n/, "");
					// Remove the @quark:start:jobs ... @quark:end:jobs block (inclusive)
					content = content.replace(
						/[ \t]*\/\/ @quark:start:jobs[\s\S]*?\/\/ @quark:end:jobs\n?/,
						"",
					);
					await fs.writeFile(registerPath, content);
				}
			}

			// Step 7e: Strip admin link from landing page when admin not selected
			if (!features.includes("admin")) {
				const homePath = path.join(
					targetDir,
					"apps",
					"web",
					"src",
					"app",
					"page.js",
				);
				if (await fs.pathExists(homePath)) {
					let content = await fs.readFile(homePath, "utf-8");
					// Remove the {/* @quark:start:admin */} ... {/* @quark:end:admin */} block
					content = content.replace(
						/[ \t]*\{\/\* @quark:start:admin \*\/\}[\s\S]*?\{\/\* @quark:end:admin \*\/\}\n?/,
						"",
					);
					await fs.writeFile(homePath, content);
				}
			}

			// Step 8: Create .env.example file
			console.log(chalk.cyan("\n  📋 Creating environment configuration..."));
			const envExampleTemplate = `# ⚠️  IMPORTANT: Copy this file to .env and fill in the values for your environment.
# NEVER commit the .env file to version control — it contains secrets!
# $ cp .env.example .env

# --- Environment ---
# Supported: development, test, staging, production (default: development)
# NODE_ENV=development

# --- Database Configuration ---
# These map to the service names in docker-compose.yml
# ⚠️  SECURITY WARNING: Change these default passwords in production!
# Generate strong passwords with: openssl rand -base64 32
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=${scope}_user
POSTGRES_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
POSTGRES_DB=${scope}_dev
# Optional: Set DATABASE_URL to override the dynamic construction above
# DATABASE_URL="postgresql://${scope}_user:CHANGE_ME_TO_STRONG_PASSWORD@localhost:5432/${scope}_dev?schema=public"

# --- Database Pool Configuration ---
# Connection pool settings are managed automatically. Customize if needed:
# For advanced tuning, see Prisma connection pool documentation.

# --- Redis Configuration ---
REDIS_HOST=localhost
REDIS_PORT=6379
# Optional: Set REDIS_URL to override the dynamic construction above
# REDIS_URL="redis://localhost:6379"

# --- Mail Configuration ---
# Email can be sent via SMTP (local or production), Resend, or Zeptomail.
# Choose one provider below based on your needs.

# Development: Mailpit local SMTP (defaults below work with docker-compose)
MAIL_HOST=localhost
MAIL_SMTP_PORT=1025
MAIL_UI_PORT=8025

# Production SMTP: Set these instead of MAIL_* when using a real SMTP relay
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_SECURE=true
# SMTP_USER=your_smtp_user
# SMTP_PASSWORD=your_smtp_password

# --- Email Provider Selection ---
# Choose one: "smtp" (default), "resend", or "zeptomail"
# EMAIL_PROVIDER=smtp
# EMAIL_FROM=App Name <noreply@yourdomain.com>

# Zeptomail (recommended for production)
# Get started at: https://www.zoho.com/zeptomail/
# Your token is shown in Zeptomail console and includes the "Zoho-enczapikey" prefix:
# e.g. ZEPTOMAIL_TOKEN=Zoho-enczapikey <your_key_here>
# ZEPTOMAIL_TOKEN=Zoho-enczapikey your_zeptomail_api_key
# ZEPTOMAIL_URL=https://api.zeptomail.com  # Base URL; /v1.1/email is appended in code
# ZEPTOMAIL_BOUNCE_EMAIL=bounce@yourdomain.com  # optional

# Resend (alternative provider)
# Get your API key at: https://resend.com/api-keys
# RESEND_API_KEY=re_xxxxxxxxxxxxx

# --- Application URL ---
# In development, APP_URL is derived automatically from PORT — no need to set it.
# In production, set this to your real domain:
# APP_URL=https://yourdomain.com

# --- Application Identity ---
# APP_NAME is used in metadata, emails, and page titles.
# ⚠️  APP_DESCRIPTION affects SEO snippets — update before production.
APP_NAME=${appDisplayName}
APP_DESCRIPTION=${appDescription}

# --- NextAuth Configuration ---
# ⚠️  CRITICAL: Generate a secure secret with: openssl rand -base64 32
# This secret is used to encrypt JWT tokens and session data
NEXTAUTH_SECRET=CHANGE_ME_TO_STRONG_SECRET

# NextAuth callback URL (auto-derived from APP_URL in development)
# In production, explicitly set this to your domain:
# NEXTAUTH_URL=https://yourdomain.com/api/auth

# --- OAuth Providers (Not Yet Implemented) ---
# OAuth support is planned for a future release.
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

# --- File Storage ---
# Provider: "local" (default) or "s3" (S3-compatible: AWS S3, Cloudflare R2, MinIO)
STORAGE_PROVIDER=local
# Local storage directory (only when STORAGE_PROVIDER=local)
# STORAGE_LOCAL_DIR=./uploads

# S3 / Cloudflare R2 (only when STORAGE_PROVIDER=s3)
# S3_BUCKET=your-bucket-name
# S3_REGION=auto                  # Use "auto" for Cloudflare R2
# S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# S3_ACCESS_KEY_ID=your-access-key
# S3_SECRET_ACCESS_KEY=your-secret-key
# S3_PUBLIC_URL=https://your-public-bucket-domain.com

# --- Upload Limits ---
# UPLOAD_MAX_SIZE=10485760   # Max file size in bytes (default: 10MB)
# UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml,application/pdf

# --- Rate Limiting & Security ---
# RATE_LIMIT_MAX=100           # Max requests per window (default: 1000 dev, 100 prod)
# RATE_LIMIT_WINDOW_MS=900000  # Window in ms (default: 15 minutes)
# API_BODY_SIZE_LIMIT=2097152  # 2MB (default)
# UPLOAD_SIZE_LIMIT=10485760   # 10MB proxy-level limit (default)

# --- Logging & Cache ---
# LOG_LEVEL=debug              # debug, info, warn, error (default: debug dev, info prod)
# CACHE_TTL=60                 # Default cache TTL in seconds (default: 60 dev, 600 prod)

# --- Database Seeding ---
# SEED_PROFILE=dev             # Options: dev (default, includes audit logs + sample job), minimal (users only)
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
POSTGRES_USER=${scope}_user
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=${scope}_dev

# --- Redis Configuration ---
REDIS_HOST=localhost
REDIS_PORT=${redisPort}

# --- Mail Configuration ---
MAIL_HOST=localhost
MAIL_SMTP_PORT=${mailSmtpPort}
MAIL_UI_PORT=${mailUiPort}

# --- Application Identity ---
# APP_NAME is used in metadata, emails, and page titles.
# ⚠️  APP_DESCRIPTION affects SEO snippets — update before production.
APP_NAME=${appDisplayName}
APP_DESCRIPTION=${appDescription}

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

# --- Database Seeding ---
# SEED_PROFILE=dev             # Options: dev (default), minimal (users only — use for production initial seed)
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
				// Track that worker is paired with jobs (not independently selectable)
				hasWorker: features.includes("jobs"),
			};
			await fs.writeFile(
				path.join(targetDir, ".quark-link.json"),
				JSON.stringify(quarkLinkJson, null, 2),
			);
			console.log(chalk.green(`    ✓ .quark-link.json`));

			// Step 10b + 10c: Generate all AI coding tool context files
			console.log(chalk.cyan("\n  🤖 Generating AI context files..."));

			// Build shared variable map (used by SKILL.md, CLAUDE.md, .cursor/rules, copilot-instructions)
			const scaffoldDate = new Date().toISOString().split("T")[0];
			const optionalLines = features
				.map((f) => {
					const labels = {
						ui: "Shared UI components",
						jobs: "Job queue definitions",
						admin: "Auto-generated admin dashboard",
					};
					return `│   ├── ${f}/           # ${labels[f] || f}`;
				})
				.join("\n");
			const optionalBlock = optionalLines ? `${optionalLines}\n` : "";

			// Step 10b: Substitute variables in project-context SKILL.md
			const skillPath = path.join(
				targetDir,
				".github",
				"skills",
				"project-context",
				"SKILL.md",
			);
			if (await fs.pathExists(skillPath)) {
				let skillContent = await fs.readFile(skillPath, "utf-8");
				skillContent = skillContent
					.replace(/__QUARK_SCOPE__/g, scope)
					.replace(/__QUARK_PROJECT_NAME__/g, projectName)
					.replace(/__QUARK_SCAFFOLD_DATE__/g, scaffoldDate)
					.replace(/__QUARK_OPTIONAL_PACKAGES__/g, optionalBlock);
				await fs.writeFile(skillPath, skillContent);
				console.log(
					chalk.green(`    ✓ .github/skills/project-context/SKILL.md`),
				);
			}

			// Step 10c: Substitute variables in all AI coding tool context files
			const aiContextFiles = [
				"README.md",
				"CLAUDE.md",
				".cursor/rules/quark.mdc",
				".github/copilot-instructions.md",
			];
			for (const relPath of aiContextFiles) {
				const filePath = path.join(targetDir, relPath);
				if (await fs.pathExists(filePath)) {
					let content = await fs.readFile(filePath, "utf-8");
					content = content
						.replace(/__QUARK_SCOPE__/g, scope)
						.replace(/__QUARK_PROJECT_NAME__/g, projectName)
						.replace(/__QUARK_SCAFFOLD_DATE__/g, scaffoldDate)
						.replace(/__QUARK_OPTIONAL_PACKAGES__/g, optionalBlock);
					await fs.writeFile(filePath, content);
					console.log(chalk.green(`    ✓ ${relPath}`));
				}
			}

			// Step 11: Initialize git repository
			console.log(chalk.cyan("\n  📝 Initializing git repository..."));
			const gitInitialized = await initializeGit(targetDir);
			if (gitInitialized) {
				console.log(chalk.green(`    ✓ Git initialized with initial commit`));
			}

			// Step 12: Run pnpm install
			if (!options.skipInstall) {
				console.log(chalk.cyan("\n  📦 Installing dependencies..."));
				try {
					await execa("pnpm", ["install"], {
						cwd: targetDir,
						stdio: "inherit",
					});
					console.log(chalk.green(`\n    ✓ Dependencies installed`));
				} catch (installError) {
					console.warn(
						chalk.yellow(
							`\n    ⚠️  pnpm install failed: ${installError.message}`,
						),
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
			}

			// Success message
			console.log(
				chalk.green.bold(
					`\n✅ Project "${projectName}" created successfully!\n`,
				),
			);

			console.log(chalk.white(`📂 Project location: ${targetDir}\n`));
			console.log(chalk.cyan("Start here:"));
			console.log(chalk.white(`  1. cd ${projectName}`));
			console.log(chalk.white(`  2. docker compose up -d`));
			console.log(chalk.white(`  3. pnpm db:migrate`));
			console.log(chalk.white(`  4. pnpm db:seed`));
			console.log(chalk.white(`  5. pnpm dev\n`));
			console.log(
				chalk.dim(
					`  Tip: set SEED_PROFILE=minimal in .env for a lean seed (admin user only)\n`,
				),
			);

			console.log(chalk.cyan("Build with AI:"));
			console.log(
				chalk.white(`  Open CLAUDE.md in your AI tool, then tell it:`),
			);
			console.log(
				chalk.white(
					`  "I'm building ${projectName} — [what it does]. Review CLAUDE.md and let's start."\n`,
				),
			);

			console.log(
				chalk.dim(
					`  📖 github.com/Bobnoddle/quark  •  Updates: npx @techstream/quark-create-app update\n`,
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
 * Read the installed version of a package from node_modules.
 * Returns null if the package is not installed.
 * @param {string} cwd - Project root
 * @param {string} packageName - e.g. "@techstream/quark-core"
 * @returns {Promise<string|null>}
 */
async function getInstalledVersion(cwd, packageName) {
	try {
		const pkgPath = path.join(
			cwd,
			"node_modules",
			...packageName.split("/"),
			"package.json",
		);
		const { version } = await fs.readJSON(pkgPath);
		return version ?? null;
	} catch {
		return null;
	}
}

/**
 * Fetch the latest published version of a package from the npm registry.
 * Returns null on network failure so the caller can degrade gracefully.
 * @param {string} packageName
 * @returns {Promise<string|null>}
 */
async function getLatestNpmVersion(packageName) {
	try {
		const { stdout } = await execa("npm", [
			"view",
			packageName,
			"version",
			"--json",
		]);
		return JSON.parse(stdout);
	} catch {
		return null;
	}
}

/**
 * quark-update command
 * Updates Quark core infrastructure in a scaffolded project
 */
program
	.command("update")
	.description("Update Quark packages in the current project")
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

		// The packages this command manages
		const MANAGED_PACKAGES = [
			"@techstream/quark-core",
			"@techstream/quark-create-app",
		];

		// Snapshot installed versions before any update
		const before = {};
		for (const name of MANAGED_PACKAGES) {
			before[name] = await getInstalledVersion(process.cwd(), name);
		}

		console.log(chalk.cyan(`Scaffolded:      ${quarkLink.scaffoldedDate}`));
		console.log(
			chalk.cyan(
				`Installed core:  ${before["@techstream/quark-core"] ?? quarkLink.quarkVersion ?? "unknown"}\n`,
			),
		);

		if (options.check) {
			// Query npm for latest versions and report the delta
			console.log(chalk.yellow("Checking npm registry for updates...\n"));
			let anyUpdates = false;
			for (const name of MANAGED_PACKAGES) {
				const installed = before[name];
				const latest = await getLatestNpmVersion(name);
				if (!latest) {
					console.log(chalk.dim(`  ${name}: registry unreachable`));
					continue;
				}
				if (!installed || installed === latest) {
					console.log(chalk.green(`  ✓ ${name} ${latest} — up to date`));
				} else {
					console.log(
						chalk.yellow(`  ↑ ${name}: ${installed} → ${chalk.bold(latest)}`),
					);
					anyUpdates = true;
				}
			}
			if (anyUpdates) {
				console.log(chalk.white("\n  Run without --check to apply updates.\n"));
			} else {
				console.log(chalk.dim("\n  Nothing to update.\n"));
			}
			return;
		}

		try {
			// Guard: check for both unstaged and staged changes
			if (!options.force) {
				try {
					await execa("git", ["diff", "--exit-code"], { cwd: process.cwd() });
					await execa("git", ["diff", "--cached", "--exit-code"], {
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

			// Run pnpm update for all managed packages
			console.log(chalk.cyan("📦 Updating Quark packages...\n"));
			await execa("pnpm", ["update", ...MANAGED_PACKAGES], {
				cwd: process.cwd(),
				stdio: "inherit",
			});

			// Snapshot installed versions after update
			const after = {};
			for (const name of MANAGED_PACKAGES) {
				after[name] = await getInstalledVersion(process.cwd(), name);
			}

			// Report the delta
			console.log(chalk.cyan("\n📋 Update summary:\n"));
			for (const name of MANAGED_PACKAGES) {
				const was = before[name];
				const now = after[name];
				if (!now) continue;
				if (was && was !== now) {
					console.log(chalk.green(`  ✓ ${name}: ${was} → ${chalk.bold(now)}`));
				} else {
					console.log(chalk.dim(`  · ${name}: ${now} (already current)`));
				}
			}

			// Persist the new core version — keep previous on failure, never write garbage
			const newCoreVersion =
				after["@techstream/quark-core"] ?? quarkLink.quarkVersion;
			quarkLink.quarkVersion = newCoreVersion;
			quarkLink.updatedDate = new Date().toISOString();
			await fs.writeFile(quarkLinkPath, JSON.stringify(quarkLink, null, 2));

			// Run lint to surface any API breakage from the update
			console.log(chalk.cyan("\n🔍 Running lint to check for breakage...\n"));
			try {
				await execa("pnpm", ["lint"], {
					cwd: process.cwd(),
					stdio: "inherit",
				});
				console.log(chalk.green("\n  ✓ Lint passed\n"));
			} catch {
				console.log(
					chalk.yellow(
						"\n  ⚠️  Lint reported issues — review before committing.\n",
					),
				);
			}

			console.log(chalk.green("✅ Quark updated successfully!\n"));
			console.log(chalk.cyan("Next steps:"));
			console.log(chalk.white(`  1. pnpm test`));
			console.log(
				chalk.white(`  2. git add . && git commit -m "chore: update Quark"\n`),
			);
		} catch (error) {
			console.error(chalk.red(`\n✗ Update failed: ${error.message}\n`));
			process.exit(1);
		}
	});

program.parse();
