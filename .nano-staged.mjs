export default {
	"packages/cli/templates/**": [],
	"{apps,packages,docs,scripts}/**/*.{js,mjs,ts,tsx,json,css}": () => [
		"node scripts/precommit-biome.mjs",
	],
};
