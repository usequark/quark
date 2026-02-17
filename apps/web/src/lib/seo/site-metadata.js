import { config, getAppUrl } from "@techstream/quark-config";
import { getMetadataRobots } from "./indexing.js";

const appUrl = getAppUrl();
const { appName, appDescription } = config;

export function getSiteMetadata() {
	return {
		metadataBase: new URL(appUrl),
		title: {
			default: appName,
			template: `%s | ${appName}`,
		},
		description: appDescription,
		applicationName: appName,
		alternates: {
			canonical: "/",
		},
		openGraph: {
			type: "website",
			url: appUrl,
			title: appName,
			description: appDescription,
			siteName: appName,
		},
		twitter: {
			card: "summary",
			title: appName,
			description: appDescription,
		},
		robots: getMetadataRobots(),
	};
}
