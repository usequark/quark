/** @type {import('next').NextConfig} */
const nextConfig = {
	// Support workspace package resolution (including @Bobnoddle/quark-db which uses
	// the Prisma driver-adapter pattern — pure JS, no native engine binary)
	transpilePackages: [
		"@Bobnoddle/quark-core",
		"@Bobnoddle/quark-db",
		"@Bobnoddle/quark-ui",
		"@Bobnoddle/quark-jobs",
	],
};

export default nextConfig;
