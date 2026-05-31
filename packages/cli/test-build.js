#!/usr/bin/env node
/**
 * Build verification test for @techstream/quark-create-app CLI
 * Runs: scaffold -> install -> build for non-interactive default and CMS scenarios
 *
 * Enable with: QUARK_CLI_BUILD_TEST=1 node test-build.js
 * Optional image scan: QUARK_CLI_SCAN_IMAGES=1 QUARK_CLI_BUILD_TEST=1 node test-build.js
 */

import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(tmpdir(), "quark-cli-build-test");
const PINNED_NODE_BASE_IMAGE =
	"node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920";
const BUILD_SCENARIOS = [
	{
		name: "default",
		projectName: "cli-build-default-app",
		features: "ui,jobs",
	},
	{
		name: "cms",
		projectName: "cli-build-cms-app",
		features: "cms",
	},
];
const SHOULD_SCAN_GENERATED_IMAGES = process.env.QUARK_CLI_SCAN_IMAGES === "1";
const TRIVY_IMAGE = process.env.QUARK_TRIVY_IMAGE || "aquasec/trivy:0.64.1";
const TRIVY_SEVERITY = process.env.QUARK_TRIVY_SEVERITY || "HIGH,CRITICAL";
const REQUIRED_ANALYTICS_FILES = [
	"apps/web/src/app/_components/UmamiReplayRecorder.js",
	"apps/web/src/lib/analytics/umami-config.js",
	"apps/web/src/lib/analytics/umami-marketing.js",
	"apps/web/src/lib/analytics/umami-replay.js",
	"apps/web/src/lib/analytics/umami.js",
];
const REQUIRED_WEB_DEPLOY_SCRIPTS = {
	"build:deploy": "pnpm build && pnpm prepare:standalone",
	"start:deploy": "node .next/standalone/apps/web/server.js",
};
const REQUIRED_WEB_RAILWAY_COMMANDS = {
	buildCommand:
		"pnpm install --frozen-lockfile && pnpm db:generate && pnpm --dir apps/web build:deploy",
	startCommand: "HOSTNAME=0.0.0.0 pnpm --dir apps/web start:deploy",
};
const REQUIRED_WEB_DOCKERFILE_SNIPPETS = [
	`FROM ${PINNED_NODE_BASE_IMAGE} AS builder`,
	`FROM ${PINNED_NODE_BASE_IMAGE} AS runtime`,
	"pnpm install --frozen-lockfile",
	"pnpm db:generate",
	"pnpm --dir apps/web build:deploy",
	"/usr/local/lib/node_modules/npm",
	"/opt/yarn-v1.22.22",
	"COPY --from=builder /app/apps/web/.next/standalone/apps/web/ ./",
	'CMD ["node", "server.js"]',
];
const REQUIRED_SCAFFOLD_DOCKERIGNORE_SNIPPETS = [
	"node_modules",
	".next",
	".env",
	"!.env.example",
];
const REQUIRED_WORKER_DOCKERFILE_SNIPPETS = [
	`FROM ${PINNED_NODE_BASE_IMAGE} AS builder`,
	`FROM ${PINNED_NODE_BASE_IMAGE} AS runtime`,
	"pnpm install --frozen-lockfile --filter ./apps/worker... --filter ./packages/db",
	"pnpm --filter ./packages/db db:generate",
	"pnpm --filter ./apps/worker --prod deploy --legacy /app/deploy",
	"/usr/local/lib/node_modules/npm",
	"/opt/yarn-v1.22.22",
	"COPY --from=builder /app/deploy/ ./",
	'CMD ["node", "src/index.js"]',
];

if (!process.env.QUARK_CLI_BUILD_TEST) {
	console.log("⏭️  Skipping build test (set QUARK_CLI_BUILD_TEST=1 to run)");
	process.exit(0);
}

await fs.remove(testDir);
await fs.ensureDir(testDir);

console.log("🧪 Build Test: Non-interactive Scaffold -> Install -> Build\n");

async function assertGeneratedAnalytics(projectPath) {
	for (const relativePath of REQUIRED_ANALYTICS_FILES) {
		if (!(await fs.pathExists(path.join(projectPath, relativePath)))) {
			throw new Error(`Missing generated analytics file: ${relativePath}`);
		}
	}

	const webPackage = await fs.readJson(
		path.join(projectPath, "apps/web/package.json"),
	);
	if (webPackage.dependencies?.rrweb !== "2.0.0-alpha.4") {
		throw new Error("Generated web app is missing the rrweb dependency");
	}
}

async function assertGeneratedDeployContract(projectPath) {
	const webPackage = await fs.readJson(
		path.join(projectPath, "apps/web/package.json"),
	);
	const dockerIgnorePath = path.join(projectPath, ".dockerignore");
	const dockerIgnore = await fs.readFile(dockerIgnorePath, "utf8");

	for (const snippet of REQUIRED_SCAFFOLD_DOCKERIGNORE_SNIPPETS) {
		if (!dockerIgnore.includes(snippet)) {
			throw new Error(
				`Generated project is missing required .dockerignore entry: ${snippet}`,
			);
		}
	}

	for (const [scriptName, command] of Object.entries(
		REQUIRED_WEB_DEPLOY_SCRIPTS,
	)) {
		if (webPackage.scripts?.[scriptName] !== command) {
			throw new Error(
				`Generated web app has unexpected ${scriptName} script: ${webPackage.scripts?.[scriptName] ?? "missing"}`,
			);
		}
	}

	const railwayConfig = await fs.readJson(
		path.join(projectPath, "apps/web/railway.json"),
	);

	if (
		railwayConfig.build?.buildCommand !==
		REQUIRED_WEB_RAILWAY_COMMANDS.buildCommand
	) {
		throw new Error(
			`Generated web app has unexpected Railway build command: ${railwayConfig.build?.buildCommand ?? "missing"}`,
		);
	}

	if (
		railwayConfig.deploy?.startCommand !==
		REQUIRED_WEB_RAILWAY_COMMANDS.startCommand
	) {
		throw new Error(
			`Generated web app has unexpected Railway start command: ${railwayConfig.deploy?.startCommand ?? "missing"}`,
		);
	}

	const webDockerfile = await fs.readFile(
		path.join(projectPath, "apps/web/Dockerfile"),
		"utf8",
	);
	for (const snippet of REQUIRED_WEB_DOCKERFILE_SNIPPETS) {
		if (!webDockerfile.includes(snippet)) {
			throw new Error(
				`Generated web Dockerfile is missing required command snippet: ${snippet}`,
			);
		}
	}

	const workerDockerfilePath = path.join(projectPath, "apps/worker/Dockerfile");
	if (await fs.pathExists(workerDockerfilePath)) {
		const workerDockerfile = await fs.readFile(workerDockerfilePath, "utf8");
		for (const snippet of REQUIRED_WORKER_DOCKERFILE_SNIPPETS) {
			if (!workerDockerfile.includes(snippet)) {
				throw new Error(
					`Generated worker Dockerfile is missing required command snippet: ${snippet}`,
				);
			}
		}
	}
}

function createDockerImageTag(projectName, serviceName) {
	const safeProjectName = projectName
		.toLowerCase()
		.replace(/[^a-z0-9_.-]+/g, "-");

	return `quark-cli-build-test-${safeProjectName}-${serviceName}`;
}

async function buildGeneratedDockerImages(
	projectPath,
	projectName,
	scenarioName,
	builtImageTags,
) {
	const imageBuilds = [
		{ serviceName: "web", dockerfilePath: "apps/web/Dockerfile" },
		{ serviceName: "worker", dockerfilePath: "apps/worker/Dockerfile" },
	];

	console.log(`\n🐋 Building Docker images for ${scenarioName}...\n`);

	for (const imageBuild of imageBuilds) {
		const absoluteDockerfilePath = path.join(
			projectPath,
			imageBuild.dockerfilePath,
		);
		if (!(await fs.pathExists(absoluteDockerfilePath))) {
			continue;
		}

		const imageTag = createDockerImageTag(projectName, imageBuild.serviceName);
		await execa(
			"docker",
			["build", "-f", imageBuild.dockerfilePath, "-t", imageTag, "."],
			{
				cwd: projectPath,
				stdio: "inherit",
			},
		);
		builtImageTags.push(imageTag);
	}
}

async function removeGeneratedDockerImages(imageTags) {
	if (imageTags.length === 0) {
		return;
	}

	console.log(`\n🧹 Removing generated Docker images...\n`);
	await execa("docker", ["image", "rm", "-f", ...imageTags], {
		stdio: "inherit",
		reject: false,
	});
}

async function scanGeneratedDockerImages(imageTags) {
	if (!SHOULD_SCAN_GENERATED_IMAGES || imageTags.length === 0) {
		return;
	}

	console.log("\n🔎 Scanning generated Docker images with Trivy...\n");

	for (const imageTag of imageTags) {
		await execa(
			"docker",
			[
				"run",
				"--rm",
				"-v",
				"/var/run/docker.sock:/var/run/docker.sock",
				TRIVY_IMAGE,
				"image",
				"--scanners",
				"vuln",
				"--skip-version-check",
				"--severity",
				TRIVY_SEVERITY,
				"--exit-code",
				"1",
				`${imageTag}:latest`,
			],
			{
				stdio: "inherit",
			},
		);
	}
}

function isTransientDatabaseStartupError(error) {
	const message = [error?.shortMessage, error?.stderr, error?.message]
		.filter(Boolean)
		.join("\n");

	return (
		message.includes("P1001") || message.includes("Can't reach database server")
	);
}

async function runWithRetry(
	action,
	{ attempts = 5, delayMs = 2_000, label, shouldRetry },
) {
	let lastError = null;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await action();
		} catch (error) {
			lastError = error;

			if (attempt === attempts || !shouldRetry(error)) {
				throw error;
			}

			console.log(
				`\n⏳ ${label} not ready yet (attempt ${attempt}/${attempts}). Retrying in ${delayMs}ms...\n`,
			);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	throw lastError;
}

async function runScenario({ name, projectName, features }) {
	const scenarioDir = path.join(testDir, name);
	const projectPath = path.join(scenarioDir, projectName);
	const cliPath = path.join(__dirname, "src/index.js");
	const builtImageTags = [];
	let dockerStarted = false;

	await fs.ensureDir(scenarioDir);

	console.log(`📦 Scaffolding ${name} project (${features || "none"})...`);
	await execa(
		"node",
		[
			cliPath,
			projectName,
			"--no-prompts",
			"--features",
			features,
			"--signup",
			"enabled",
			"--skip-docker",
		],
		{
			cwd: scenarioDir,
			env: {
				...process.env,
				QUARK_SKIP_GIT_INIT: "true",
			},
			stdio: "inherit",
		},
	);

	if (!(await fs.pathExists(projectPath))) {
		throw new Error(`Project directory not created for scenario: ${name}`);
	}

	await assertGeneratedAnalytics(projectPath);
	await assertGeneratedDeployContract(projectPath);

	try {
		await execa("docker", ["compose", "down", "-v"], {
			cwd: projectPath,
			stdio: "inherit",
			reject: false,
		});

		console.log(`\n🐳 Starting Docker services for ${name}...\n`);
		await execa("docker", ["compose", "up", "-d", "--wait"], {
			cwd: projectPath,
			stdio: "inherit",
		});
		dockerStarted = true;

		console.log(`\n🗃️  Running database migrations for ${name}...\n`);
		await runWithRetry(
			() =>
				execa(
					"pnpm",
					[
						"exec",
						"dotenv",
						"-e",
						".env",
						"--",
						"pnpm",
						"--filter",
						"./packages/db",
						"db:migrate:deploy",
					],
					{
						cwd: projectPath,
						stdio: "inherit",
					},
				),
			{
				attempts: 5,
				delayMs: 2_000,
				label: `${name} database`,
				shouldRetry: isTransientDatabaseStartupError,
			},
		);

		console.log(`\n🏗️  Running deploy build for ${name}...\n`);
		await execa(
			"pnpm",
			[
				"exec",
				"dotenv",
				"-e",
				".env",
				"--",
				"pnpm",
				"--filter",
				`@${projectName}/web`,
				"build:deploy",
			],
			{
				cwd: projectPath,
				stdio: "inherit",
			},
		);
	} finally {
		if (dockerStarted) {
			console.log(`\n🧹 Stopping Docker services for ${name}...\n`);
			await execa("docker", ["compose", "down", "-v"], {
				cwd: projectPath,
				stdio: "inherit",
			});
		}
	}

	try {
		await buildGeneratedDockerImages(
			projectPath,
			projectName,
			name,
			builtImageTags,
		);
		await scanGeneratedDockerImages(builtImageTags);

		console.log(`\n✅ ${name} deploy build completed successfully\n`);
	} finally {
		await removeGeneratedDockerImages(builtImageTags);
	}
}

try {
	for (const scenario of BUILD_SCENARIOS) {
		await runScenario(scenario);
	}

	console.log("\n✅ Build completed successfully\n");
} catch (error) {
	console.error("\n❌ Build test failed:\n");
	console.error(error.message || error);
	process.exit(1);
} finally {
	await fs.remove(testDir);
}
