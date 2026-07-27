export function isWebsiteIndexable(env = process.env) {
	const productionEnv = (env.NODE_ENV || "").toLowerCase() === "production";
	const explicitAllow = (env.ALLOW_INDEXING || "").toLowerCase() === "true";
	return productionEnv && explicitAllow;
}

export function getMetadataRobots(env = process.env) {
	if (isWebsiteIndexable(env)) {
		return {
			index: true,
			follow: true,
		};
	}

	return {
		index: false,
		follow: false,
		nocache: true,
		googleBot: {
			index: false,
			follow: false,
			noimageindex: true,
		},
	};
}
