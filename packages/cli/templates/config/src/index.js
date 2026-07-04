export const config = {
	appName: process.env.APP_NAME || "Quark",
	appDescription: process.env.APP_DESCRIPTION || "A Quark-powered application",
};

export { getAllowedOrigins, getAppUrl, syncNextAuthUrl } from "./app-url.js";
export {
	ENVIRONMENTS,
	getEnvironmentConfig,
	mergeConfig,
	resolveEnvironment,
} from "./environment.js";
export { getConfig, loadConfig, resetConfig } from "./load-config.js";
export { applyRateLimit, rateLimit } from "./rate-limit.js";
export { closeSharedRedisClient, getSharedRedisClient } from "./redis.js";
export { loadEnv } from "./validate-env.js";
