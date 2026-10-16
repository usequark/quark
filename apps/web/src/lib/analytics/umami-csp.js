import { getUmamiCspOrigins } from "./umami-config.js";

export function buildContentSecurityPolicy(env = process.env) {
	const isProduction = env.NODE_ENV === "production";
	// Same-origin proxy: analytics needs no allowlist entries beyond 'self'.
	const { connectSrc: umamiConnectSrc, scriptSrc: umamiScriptSrc } =
		getUmamiCspOrigins();

	const scriptSrc = [
		"script-src",
		"'self'",
		"'unsafe-inline'",
		...(isProduction ? [] : ["'unsafe-eval'"]),
		...umamiScriptSrc,
	].join(" ");

	const connectSrc = [
		"connect-src",
		"'self'",
		...(isProduction ? [] : ["ws:", "wss:"]),
		...umamiConnectSrc,
	].join(" ");

	return `default-src 'self'; ${scriptSrc}; ${connectSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';`;
}
