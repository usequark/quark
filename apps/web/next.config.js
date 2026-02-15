/** @type {import('next').NextConfig} */
const nextConfig = {
	// Support workspace package resolution (including @techstream/quark-db which uses
	// the Prisma driver-adapter pattern — pure JS, no native engine binary)
	transpilePackages: [
		"@techstream/quark-core",
		"@techstream/quark-db",
		"@techstream/quark-ui",
		"@techstream/quark-jobs",
	],

	// Security headers
	// NOTE: These are also applied by proxy.js for proxy-matched routes.
	// Keeping them here as a fallback for routes the proxy doesn't match.
	async headers() {
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
						value:
							"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';",
					},
				],
			},
		];
	},

	// Environment variables validation
	env: {
		APP_URL: process.env.APP_URL,
		NEXTAUTH_URL: process.env.NEXTAUTH_URL || process.env.APP_URL,
		NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
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
