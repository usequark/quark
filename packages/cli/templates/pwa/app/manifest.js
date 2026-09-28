import { config, getAppUrl } from "@__QUARK_SCOPE__/config";

/**
 * PWA app manifest.
 *
 * This deliberately replaces the base project's `manifest.js` rather than
 * adding a second manifest file: Next.js serves `app/manifest.js` at
 * `/manifest.webmanifest`, and a sibling `app/manifest.json` makes the build
 * fail with "Cannot find module for page: /manifest.webmanifest".
 */
export default function manifest() {
	return {
		name: config.appName,
		short_name: config.appName,
		description: config.appDescription,
		theme_color: "#000000",
		background_color: "#000000",
		display: "standalone",
		orientation: "portrait-primary",
		start_url: "/",
		scope: "/",
		id: getAppUrl(),
		icons: [
			{
				src: "/quark.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any maskable",
			},
		],
	};
}
