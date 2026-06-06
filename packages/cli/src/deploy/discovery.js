import fs from "node:fs/promises";
import path from "node:path";
import {
	QUARK_DEPLOY_PROJECT_KIND,
	QUARK_SERVICE_CONTRACTS,
	SUPPORTED_QUARK_SERVICE_KINDS,
} from "./contract.js";

export const QUARK_DEPLOY_DIAGNOSTIC_CODES = Object.freeze({
	MISSING_REQUIRED_SERVICE: "missing_required_service",
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

		services.push(
			createDiscoveredService(projectDir, serviceContract, packageJson),
		);
	}

	return {
		kind: QUARK_DEPLOY_PROJECT_KIND,
		rootDir: projectDir,
		services,
		diagnostics,
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
