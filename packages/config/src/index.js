export const config = {
	appName: "Quark",
};

export { getAllowedOrigins, getAppUrl, syncNextAuthUrl } from "./app-url.js";
export {
	ENVIRONMENTS,
	getEnvironmentConfig,
	mergeConfig,
	resolveEnvironment,
} from "./environment.js";
export { getConfig, loadConfig, resetConfig } from "./load-config.js";
