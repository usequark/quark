export const config = {
	appName: process.env.APP_NAME || "Quark",
	appDescription:
		process.env.APP_DESCRIPTION ||
		"A modern monorepo with Next.js, React, and Prisma",
};

export { getAllowedOrigins, getAppUrl, syncNextAuthUrl } from "./app-url.js";
export {
	ENVIRONMENTS,
	getEnvironmentConfig,
	mergeConfig,
	resolveEnvironment,
} from "./environment.js";
export { getConfig, loadConfig, resetConfig } from "./load-config.js";
export { loadEnv, validateEnv } from "./validate-env.js";
