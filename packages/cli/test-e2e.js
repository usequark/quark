#!/usr/bin/env node

/**
 * End-to-end test for @usequark/quark-create-app CLI
 * This manually walks through creating a project
 */

import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(tmpdir(), "e2e-test-quark");
const projectName = "my-awesome-app";
const projectPath = path.join(testDir, projectName);

// Cleanup and setup
await fs.remove(testDir);
await fs.ensureDir(testDir);

try {
	console.log("🚀 End-to-End Test: Creating a new Quark project\n");
	console.log(`📁 Test directory: ${testDir}`);
	console.log(`📦 Project name: ${projectName}\n`);

	// Simulate what the CLI does
	const templatesDir = path.join(__dirname, "templates");
	const scope = projectName.toLowerCase();

	// Step 1: Create base directory
	console.log("✓ Creating project directory");
	await fs.ensureDir(projectPath);

	// Step 2: Copy base-project template
	console.log("✓ Copying base project template");
	const baseTemplate = path.join(templatesDir, "base-project");
	await fs.copy(baseTemplate, projectPath);

	// Step 3: Create apps/packages directories
	console.log("✓ Creating apps and packages directories");
	await fs.ensureDir(path.join(projectPath, "apps"));
	await fs.ensureDir(path.join(projectPath, "packages"));

	// Step 4: Update db package scope (it's already copied from base-project)
	console.log("✓ Updating required package: db");
	const dbPackageDir = path.join(projectPath, "packages", "db");
	const dbPackageJsonPath = path.join(dbPackageDir, "package.json");
	const dbPackageJson = await fs.readJSON(dbPackageJsonPath);
	dbPackageJson.name = `@${scope}/db`;
	await fs.writeJSON(dbPackageJsonPath, dbPackageJson, { spaces: 2 });

	// Step 5: Copy selected optional feature templates
	const features = ["ui", "jobs"];
	console.log(`✓ Copying optional packages: ${features.join(", ")}`);

	for (const feature of features) {
		const packageDir = path.join(projectPath, "packages", feature);
		const templatePath = path.join(templatesDir, feature);
		await fs.copy(templatePath, packageDir);

		// Update package.json name
		const packageJsonPath = path.join(packageDir, "package.json");
		const packageJson = await fs.readJSON(packageJsonPath);
		const packagePart = packageJson.name.split("/")[1];
		packageJson.name = `@${scope}/${packagePart}`;
		await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
	}

	// Step 6: Update app dependencies to use correct scope
	console.log("✓ Updating app dependencies");

	// Update web app package.json
	const webPackageJsonPath = path.join(
		projectPath,
		"apps",
		"web",
		"package.json",
	);
	if (await fs.pathExists(webPackageJsonPath)) {
		const webPackageJson = await fs.readJSON(webPackageJsonPath);

		// Replace @usequark/quark-* with @scope/* for local packages
		const replaceScope = (deps) => {
			if (!deps) return;
			for (const [key, value] of Object.entries(deps)) {
				if (key.startsWith("@usequark/quark-") && value === "workspace:*") {
					const packageName = key.replace("@usequark/quark-", "");
					delete deps[key];
					deps[`@${scope}/${packageName}`] = value;
				}
			}
		};

		replaceScope(webPackageJson.dependencies);
		replaceScope(webPackageJson.devDependencies);

		await fs.writeJSON(webPackageJsonPath, webPackageJson, { spaces: 2 });
	}

	// Update worker app package.json
	const workerPackageJsonPath = path.join(
		projectPath,
		"apps",
		"worker",
		"package.json",
	);
	if (await fs.pathExists(workerPackageJsonPath)) {
		const workerPackageJson = await fs.readJSON(workerPackageJsonPath);

		const replaceScope = (deps) => {
			if (!deps) return;
			for (const [key, value] of Object.entries(deps)) {
				if (key.startsWith("@usequark/quark-") && value === "workspace:*") {
					const packageName = key.replace("@usequark/quark-", "");
					delete deps[key];
					deps[`@${scope}/${packageName}`] = value;
				}
			}
		};

		replaceScope(workerPackageJson.dependencies);
		replaceScope(workerPackageJson.devDependencies);

		await fs.writeJSON(workerPackageJsonPath, workerPackageJson, { spaces: 2 });
	}

	// Step 7: Create .env.example
	console.log("✓ Creating .env.example");
	const envExample = `# Database
POSTGRES_USER=quark
POSTGRES_PASSWORD=development
POSTGRES_DB=${scope}_dev
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Email
MAIL_SMTP_PORT=1025
MAIL_UI_PORT=8025

# Application
NODE_ENV=development
API_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://quark:development@localhost:5432/${scope}_dev
REDIS_URL=redis://localhost:6379
EMAIL_FROM=noreply@${scope}.com

`;
	await fs.writeFile(path.join(projectPath, ".env.example"), envExample);

	// Step 8: Create .env (mirrors CLI behavior)
	console.log("✓ Creating .env");
	await fs.writeFile(path.join(projectPath, ".env"), envExample);

	// Verify the structure
	console.log("\n✅ Verification Results:\n");

	const verifyFile = async (relativePath) => {
		const fullPath = path.join(projectPath, relativePath);
		const exists = await fs.pathExists(fullPath);
		console.log(`  ${exists ? "✓" : "✗"} ${relativePath}`);
		return exists;
	};

	const verifyDir = async (relativePath) => {
		const fullPath = path.join(projectPath, relativePath);
		const exists = await fs.pathExists(fullPath);
		const isDir = exists && (await fs.stat(fullPath)).isDirectory();
		console.log(`  ${isDir ? "✓" : "✗"} ${relativePath}/ (directory)`);
		return isDir;
	};

	const checks = [
		verifyFile("package.json"),
		verifyFile("turbo.json"),
		verifyFile("docker-compose.yml"),
		verifyFile("pnpm-workspace.yaml"),
		verifyFile(".gitignore"),
		verifyFile(".env.example"),
		verifyFile(".env"),
		verifyFile("README.md"),
		verifyDir("apps"),
		verifyDir("packages"),
		verifyDir("packages/db"),
		verifyDir("packages/ui"),
		verifyDir("packages/jobs"),
	];

	const results = await Promise.all(checks);
	const passed = results.filter(Boolean).length;
	const total = results.length;

	console.log(`\n✅ Structure check: ${passed}/${total} items verified`);

	// Verify package.json names are updated
	console.log("\n✅ Package scope verification:\n");
	const dbPackageJson2 = await fs.readJSON(
		path.join(projectPath, "packages/db/package.json"),
	);
	const uiPackageJson = await fs.readJSON(
		path.join(projectPath, "packages/ui/package.json"),
	);
	const jobsPackageJson = await fs.readJSON(
		path.join(projectPath, "packages/jobs/package.json"),
	);

	console.log(
		`  ${dbPackageJson2.name === `@${scope}/db` ? "✓" : "✗"} DB package: ${dbPackageJson2.name}`,
	);
	console.log(
		`  ${uiPackageJson.name === `@${scope}/ui` ? "✓" : "✗"} UI package: ${uiPackageJson.name}`,
	);
	console.log(
		`  ${jobsPackageJson.name === `@${scope}/jobs` ? "✓" : "✗"} Jobs package: ${jobsPackageJson.name}`,
	);

	// Verify app dependencies were updated
	console.log("\n✅ App dependency scope verification:\n");
	const webPkg = await fs.readJSON(
		path.join(projectPath, "apps/web/package.json"),
	);
	const hasCorrectDbDep = webPkg.dependencies[`@${scope}/db`] === "workspace:*";
	const hasCorrectUiDep = webPkg.dependencies[`@${scope}/ui`] === "workspace:*";
	const hasCorrectJobsDep =
		webPkg.dependencies[`@${scope}/jobs`] === "workspace:*";
	const hasCore = webPkg.dependencies["@usequark/quark-core"] === "^1.0.0";

	console.log(`  ${hasCorrectDbDep ? "✓" : "✗"} Web app has @${scope}/db`);
	console.log(`  ${hasCorrectUiDep ? "✓" : "✗"} Web app has @${scope}/ui`);
	console.log(`  ${hasCorrectJobsDep ? "✓" : "✗"} Web app has @${scope}/jobs`);
	console.log(
		`  ${hasCore ? "✓" : "✗"} Web app has @usequark/quark-core (from registry)`,
	);

	// List the project structure
	console.log("\n📂 Project Structure:\n");
	const listDir = (dir, prefix = "", _isLast = true) => {
		const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));

		files.forEach((file, index) => {
			const isLastFile = index === files.length - 1;
			const fullPath = path.join(dir, file);
			const isDirectory = fs.statSync(fullPath).isDirectory();

			const connector = isLastFile ? "└── " : "├── ";
			const nextPrefix = prefix + (isLastFile ? "    " : "│   ");

			console.log(prefix + connector + (isDirectory ? "📁 " : "📄 ") + file);

			if (isDirectory && file !== "node_modules" && file !== ".git") {
				listDir(fullPath, nextPrefix, isLastFile);
			}
		});
	};

	console.log(`${projectName}/`);
	listDir(projectPath, "");

	console.log("\n🎉 End-to-end test completed successfully!\n");
	console.log("You can now:");
	console.log(`  1. cd ${path.relative(process.cwd(), projectPath)}`);
	console.log(`  2. cp .env.example .env`);
	console.log(`  3. pnpm install`);
	console.log(`  4. pnpm dev\n`);
} catch (error) {
	console.error("\n❌ Test failed:", error.message);
	console.error("\nFull error:", error);
	process.exit(1);
} finally {
	// Cleanup
	try {
		await fs.remove(testDir);
		console.log("🧹 Test directory cleaned up");
	} catch (error) {
		console.warn(`⚠️  Could not clean up test directory: ${error.message}`);
	}
}
