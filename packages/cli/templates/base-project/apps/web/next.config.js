import { hostname, networkInterfaces } from "node:os";

import { getUmamiCspOrigins } from "./src/lib/analytics/umami-config.js";

function getLocalNetworkHosts() {
	const hosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

	for (const entries of Object.values(networkInterfaces())) {
		for (const entry of entries || []) {
			if (!entry || entry.internal || entry.family !== "IPv4") continue;
			hosts.add(entry.address.split("%")[0]);
		}
	}

	const machineHostname = hostname().trim();
	if (machineHostname) {
		hosts.add(machineHostname);
		if (!machineHostname.endsWith(".local")) {
			hosts.add(`${machineHostname}.local`);
		}
	}

	return [...hosts];
}

function getAllowedDevOrigins() {
	const configuredOrigins = (
		process.env.NEXT_DEV_ALLOWED_ORIGINS ||
		process.env.ALLOWED_DEV_ORIGINS ||
		""
	)
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

	return [...new Set([...getLocalNetworkHosts(), ...configuredOrigins])];
}

const allowedDevOrigins =
	process.env.NODE_ENV === "development" ? getAllowedDevOrigins() : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Required for Railway deployment — produces a self-contained build
	// at .next/standalone that can run without node_modules.
	output: "standalone",
	outputFileTracingIncludes: {
		"/*": ["../../packages/db/prisma/schema.prisma"],
	},
	allowedDevOrigins,

	// Support workspace package resolution (including @techstream/quark-db which uses
	// the Prisma driver-adapter pattern — pure JS, no native engine binary)
	transpilePackages: [
		"@techstream/quark-admin",
		"@techstream/quark-cms",
		"@techstream/quark-core",
		"@techstream/quark-db",
		"@techstream/quark-ui",
		"@techstream/quark-jobs",
	],

	// Security headers
	// NOTE: These are also applied by proxy.js for proxy-matched routes.
	// Keeping them here as a fallback for routes the proxy doesn't match.
	async headers() {
		const isProd = process.env.NODE_ENV === "production";
		const { connectSrc: umamiConnectSrc, scriptSrc: umamiScriptSrc } =
			getUmamiCspOrigins();
		const connectSrc = [
			"connect-src",
			"'self'",
			...(isProd ? [] : ["ws:", "wss:"]),
			...umamiConnectSrc,
		].join(" ");
		const scriptSrc = [
			"script-src",
			"'self'",
			"'unsafe-inline'",
			...(isProd ? [] : ["'unsafe-eval'"]),
			...umamiScriptSrc,
		].join(" ");

		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
					{
						key: "X-Frame-Options",
						value: "SAMEORIGIN",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
					{
						key: "Content-Security-Policy",
						// unsafe-eval is required by Turbopack in development only.
						// It is deliberately excluded from the production directive.
						value: `default-src 'self'; ${scriptSrc}; ${connectSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';`,
					},
				],
			},
		];
	},

	// Environment variables validation
	env: {
		APP_URL: process.env.APP_URL,
		NEXTAUTH_URL: process.env.NEXTAUTH_URL || process.env.APP_URL,
	},

	// Request body size limits (security)
	experimental: {
		// Limit request body size to prevent DoS attacks
		// Default is 4MB, we're being explicit here
		// Adjust based on your needs (e.g., larger for file uploads)
		serverActions: {
			bodySizeLimit: "2mb", // For Server Actions
		},
	},

	// API route configuration
	async rewrites() {
		return [];
	},

	// Compiler options for production optimization
	compiler: {
		removeConsole:
			process.env.NODE_ENV === "production"
				? { exclude: ["error", "warn"] }
				: false,
	},

	// Image optimization configuration
	images: {
		domains: [],
		formats: ["image/avif", "image/webp"],
	},

	// Production-only settings
	poweredByHeader: false,
	compress: true,
};

export default nextConfig;
