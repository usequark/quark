/** @type {import('next').NextConfig} */
const nextConfig = {
	// Support workspace package resolution (including @bobnoddle/quark-db which uses
	// the Prisma driver-adapter pattern — pure JS, no native engine binary)
	transpilePackages: [
		"@bobnoddle/quark-core",
		"@bobnoddle/quark-db",
		"@bobnoddle/quark-ui",
		"@bobnoddle/quark-jobs",
	],

	// Security headers
	// NOTE: These are also applied by middleware.js for middleware-matched routes.
	// Keeping them here as a fallback for routes the middleware doesn't match.
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
						key: "X-XSS-Protection",
						value: "1; mode=block",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
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
