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
};

export default nextConfig;
