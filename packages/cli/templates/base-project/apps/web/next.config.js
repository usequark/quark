import { hostname, networkInterfaces } from "node:os";
import { getUmamiUpstreamBase } from "./src/lib/analytics/umami-config.js";
import { buildContentSecurityPolicy } from "./src/lib/analytics/umami-csp.js";

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
	// Required for Railway deployment - produces a self-contained build
	// at .next/standalone that can run without node_modules.
	output: "standalone",
	outputFileTracingIncludes: {
		"/*": ["../../packages/db/prisma/schema.prisma"],
	},
	allowedDevOrigins,

	// Keep BullMQ out of the Turbopack/webpack graph — its ESM build imports
	// Node built-ins (child_process, net, worker_threads, dns, fs).
	serverExternalPackages: ["bullmq"],

	// Support workspace package resolution (including @usequark/quark-db which uses
	// the Prisma driver-adapter pattern - pure JS, no native engine binary)
	transpilePackages: [
		"@usequark/quark-core",
		"@usequark/quark-db",
		"@usequark/quark-ui",
		"@usequark/quark-jobs",
	],

	// Security headers
	// NOTE: These are also applied by proxy.js for proxy-matched routes.
	// Keeping them here as a fallback for routes the proxy doesn't match.
	async headers() {
		return [
			{
				// First-party Umami tracker. Served via rewrites() from the
				// upstream host; tuned cache here because rewrites pass the
				// upstream Cache-Control through unchanged.
				source: "/s/script.js",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=3600, stale-while-revalidate=86400",
					},
				],
			},
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
						value: buildContentSecurityPolicy(),
					},
				],
			},
		];
	},

	// Environment variables validation
	//
	// NEXTAUTH_URL is read by next-auth/react *in the browser*, so it has to be
	// inlined at build time. Leaving it undefined when APP_URL/NEXTAUTH_URL are
	// unset made the client fall back to next-auth's hardcoded
	// http://localhost:3000/api/auth regardless of PORT or host. Derive the same
	// fallback the server uses (packages/config/src/app-url.js) so both sides
	// agree.
	env: {
		APP_URL: process.env.APP_URL,
		NEXTAUTH_URL:
			process.env.NEXTAUTH_URL ||
			process.env.APP_URL ||
			`http://localhost:${process.env.PORT || 3000}`,
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
	// First-party Umami proxy: GET /s/script.js is served from the upstream
	// analytics host so the tracker URL is same-origin. POST ingest
	// (/s/api/send|collect|record) goes through a Route Handler instead —
	// rewrites cannot strip/append headers (cookie strip, X-Forwarded-For
	// for geo, x-umami-cache for replay).
	async rewrites() {
		const upstream = getUmamiUpstreamBase(process.env);
		if (!upstream) return [];
		return [{ source: "/s/script.js", destination: `${upstream}/script.js` }];
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
