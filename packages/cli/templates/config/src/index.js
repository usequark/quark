export const config = {
	appName: "Quark",
	appDescription: "A modern monorepo with Next.js, React, and Prisma",
};

export { getAllowedOrigins, getAppUrl, syncNextAuthUrl } from "./app-url.js";
export {
	ENVIRONMENTS,
	getEnvironmentConfig,
	mergeConfig,
	resolveEnvironment,
} from "./environment.js";
export { getConfig, loadConfig, resetConfig } from "./load-config.js";
