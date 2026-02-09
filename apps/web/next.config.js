/** @type {import('next').NextConfig} */
const nextConfig = {
	// Support workspace package resolution (including @quark/db which uses
	// the Prisma driver-adapter pattern — pure JS, no native engine binary)
	transpilePackages: ["@quark/core", "@quark/db", "@quark/ui", "@quark/jobs"],
};

export default nextConfig;
