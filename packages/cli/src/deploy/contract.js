export const QUARK_DEPLOY_PROJECT_KIND = "quark";

export const QUARK_SERVICE_KINDS = Object.freeze({
	WEB: "web",
	WORKER: "worker",
});

const webServiceContract = Object.freeze({
	kind: QUARK_SERVICE_KINDS.WEB,
	name: "web",
	required: true,
	relativeRootDir: "apps/web",
	relativePackageJsonPath: "apps/web/package.json",
	runtime: Object.freeze({
		type: "node",
		relativeEntrypoint: "apps/web/.next/standalone/apps/web/server.js",
		healthcheckPath: "/api/health",
	}),
});

const workerServiceContract = Object.freeze({
	kind: QUARK_SERVICE_KINDS.WORKER,
	name: "worker",
	required: false,
	relativeRootDir: "apps/worker",
	relativePackageJsonPath: "apps/worker/package.json",
	runtime: Object.freeze({
		type: "node",
		relativeEntrypoint: "apps/worker/src/index.js",
	}),
});

export const QUARK_SERVICE_CONTRACTS = Object.freeze({
	[QUARK_SERVICE_KINDS.WEB]: webServiceContract,
	[QUARK_SERVICE_KINDS.WORKER]: workerServiceContract,
});

export const SUPPORTED_QUARK_SERVICE_KINDS = Object.freeze([
	QUARK_SERVICE_KINDS.WEB,
	QUARK_SERVICE_KINDS.WORKER,
]);
