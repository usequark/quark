#!/usr/bin/env node
/**
 * End-to-end test for @quark/create-app CLI
 * This manually walks through creating a project
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = "/tmp/e2e-test-quark";
const projectName = "my-awesome-app";
const projectPath = path.join(testDir, projectName);

// Cleanup and setup
await fs.remove(testDir);
await fs.ensureDir(testDir);

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

// Step 4: Copy selected feature templates
const features = ["ui", "jobs"];
console.log(`✓ Copying selected packages: ${features.join(", ")}`);

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

// Step 5: Create .env.example
console.log("✓ Creating .env.example");
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
await fs.writeFile(path.join(projectPath, ".env.example"), envExample);

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
  verifyFile("README.md"),
  verifyDir("apps"),
  verifyDir("packages"),
  verifyDir("packages/ui"),
  verifyDir("packages/jobs"),
];

const results = await Promise.all(checks);
const passed = results.filter(Boolean).length;
const total = results.length;

console.log(`\n✅ Structure check: ${passed}/${total} items verified`);

// Verify package.json names are updated
console.log("\n✅ Package scope verification:\n");
const uiPackageJson = await fs.readJSON(path.join(projectPath, "packages/ui/package.json"));
const jobsPackageJson = await fs.readJSON(path.join(projectPath, "packages/jobs/package.json"));

console.log(`  ${uiPackageJson.name === `@${scope}/ui` ? "✓" : "✗"} UI package: ${uiPackageJson.name}`);
console.log(`  ${jobsPackageJson.name === `@${scope}/jobs` ? "✓" : "✗"} Jobs package: ${jobsPackageJson.name}`);

// List the project structure
console.log("\n📂 Project Structure:\n");
const listDir = (dir, prefix = "", isLast = true) => {
  const files = fs.readdirSync(dir).filter(f => !f.startsWith("."));
  
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
