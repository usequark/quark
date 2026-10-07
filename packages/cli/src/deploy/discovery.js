import fs from "node:fs/promises";
import path from "node:path";
import {
	QUARK_DEPLOY_PROJECT_KIND,
	QUARK_SERVICE_CONTRACTS,
	QUARK_SERVICE_KINDS,
	SUPPORTED_QUARK_SERVICE_KINDS,
} from "./contract.js";

export const QUARK_DEPLOY_DIAGNOSTIC_CODES = Object.freeze({
	MISSING_REQUIRED_SERVICE: "missing_required_service",
});

/**
 * Codes for conditions that do not block a deploy but are worth saying out loud.
 *
 * Kept separate from DIAGNOSTIC_CODES because `resolveQuarkDeployProject` throws on
 * any diagnostic, and a worker-less project is a legitimate choice — `jobs` is an
 * optional scaffold feature. Failing the deploy would punish a valid configuration.
 */
export const QUARK_DEPLOY_WARNING_CODES = Object.freeze({
	MISSING_WORKER_SERVICE: "missing_worker_service",
});

function resolveProjectPath(projectDir, relativePath) {
	return path.join(projectDir, ...relativePath.split("/"));
}

async function readJsonIfExists(filePath) {
	try {
		const contents = await fs.readFile(filePath, "utf8");
		return JSON.parse(contents);
	} catch (error) {
		if (error && typeof error === "object" && error.code === "ENOENT") {
			return null;
		}

		throw error;
	}
}

function createMissingRequiredServiceDiagnostic(serviceContract) {
	return {
		code: QUARK_DEPLOY_DIAGNOSTIC_CODES.MISSING_REQUIRED_SERVICE,
		serviceKind: serviceContract.kind,
		required: true,
		expectedPath: serviceContract.relativePackageJsonPath,
		message: `Missing required Quark ${serviceContract.name} service at ${serviceContract.relativePackageJsonPath}.`,
	};
}

function createMissingWorkerWarning() {
	return {
		code: QUARK_DEPLOY_WARNING_CODES.MISSING_WORKER_SERVICE,
		serviceKind: "worker",
		required: false,
		expectedPath: QUARK_SERVICE_CONTRACTS.worker.relativePackageJsonPath,
		message:
			"No Quark worker service found. Scheduled jobs will not run — including CLEANUP_ORPHANED_FILES, which is the only thing that sweeps the File rows left orphaned when a user is deleted (onDelete: SetNull keeps the rows and the blobs). Those rows and blobs accumulate indefinitely. Add the jobs feature (`npx @usequark/quark-create-app add jobs`) if this project uploads files.",
	};
}

function createDiscoveredService(projectDir, serviceContract, packageJson) {
	return {
		kind: serviceContract.kind,
		name: serviceContract.name,
		required: serviceContract.required,
		rootDir: resolveProjectPath(projectDir, serviceContract.relativeRootDir),
		relativeRootDir: serviceContract.relativeRootDir,
		packageJsonPath: resolveProjectPath(
			projectDir,
			serviceContract.relativePackageJsonPath,
		),
		relativePackageJsonPath: serviceContract.relativePackageJsonPath,
		packageName:
			typeof packageJson?.name === "string" ? packageJson.name : null,
		runtime: {
			...serviceContract.runtime,
			entrypointPath: resolveProjectPath(
				projectDir,
				serviceContract.runtime.relativeEntrypoint,
			),
		},
	};
}

export function formatQuarkDeployDiagnostics(diagnostics) {
	return diagnostics.map((diagnostic) => diagnostic.message).join(". ");
}

export async function discoverQuarkDeployProject(projectDir) {
	const services = [];
	const diagnostics = [];
	const warnings = [];
	let sawWeb = false;
	let sawWorker = false;

	for (const serviceKind of SUPPORTED_QUARK_SERVICE_KINDS) {
		const serviceContract = QUARK_SERVICE_CONTRACTS[serviceKind];
		const packageJson = await readJsonIfExists(
			resolveProjectPath(projectDir, serviceContract.relativePackageJsonPath),
		);

		if (!packageJson) {
			if (serviceContract.required) {
				diagnostics.push(
					createMissingRequiredServiceDiagnostic(serviceContract),
				);
			}

			continue;
		}

		if (serviceKind === QUARK_SERVICE_KINDS.WEB) sawWeb = true;
		if (serviceKind === QUARK_SERVICE_KINDS.WORKER) sawWorker = true;

		services.push(
			createDiscoveredService(projectDir, serviceContract, packageJson),
		);
	}

	// A web project with no worker is valid — `jobs` is optional — but the orphaned
	// file cleanup only runs there, so say so rather than letting it fail silently.
	if (sawWeb && !sawWorker) {
		warnings.push(createMissingWorkerWarning());
	}

	return {
		kind: QUARK_DEPLOY_PROJECT_KIND,
		rootDir: projectDir,
		services,
		diagnostics,
		warnings,
	};
}

export async function resolveQuarkDeployProject(projectDir) {
	const discovery = await discoverQuarkDeployProject(projectDir);

	if (discovery.diagnostics.length > 0) {
		const error = new Error(
			formatQuarkDeployDiagnostics(discovery.diagnostics),
		);
		error.code = "QUARK_DEPLOY_DISCOVERY_FAILED";
		error.diagnostics = discovery.diagnostics;
		error.discovery = discovery;
		throw error;
	}

	return discovery;
}
