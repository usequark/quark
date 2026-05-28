export default {
	"packages/cli/templates/**": [],
	"{apps,packages,docs,scripts}/**/*.{js,jsx,mjs,json,css}": () => [
		"node scripts/precommit-biome.mjs",
	],
};
