export function isWebsiteIndexable(env = process.env) {
	return env.ALLOW_INDEXING === "true";
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
