import { config, getAppUrl } from "@usequark/quark-config";
import { getMetadataRobots } from "./indexing.js";

export function getSiteMetadata() {
	const appUrl = getAppUrl();
	const { appName, appDescription } = config;

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

/**
 * Build per-page metadata. Titles are rendered as `{ absolute }` so the
 * root layout template (`%s | Brand`) is applied exactly once.
 *
 * Page-title conventions (see the `seo` skill): keyword-first for
 * money/service pages, `Entity | Brand` for detail pages, 50-60 chars.
 * The SEO title may differ from the visible H1 on CMS-driven pages.
 *
 * @param {object} options
 * @param {string} options.title - SEO title (brand suffix appended).
 * @param {string} [options.description] - Meta description (150-160 chars).
 * @param {string} [options.path] - Route path used for the canonical URL.
 * @param {boolean} [options.noIndex=false] - Force noindex/noindex robots.
 */
export function getPageMetadata({ title, description, path, noIndex = false }) {
	const appUrl = getAppUrl();
	const { appName, appDescription } = config;
	const resolvedDescription = description ?? appDescription;

	return {
		title: {
			absolute: `${title} | ${appName}`,
		},
		description: resolvedDescription,
		alternates: path ? { canonical: path } : undefined,
		openGraph: {
			type: "website",
			url: path ? new URL(path, appUrl).toString() : appUrl,
			title,
			description: resolvedDescription,
			siteName: appName,
		},
		twitter: {
			card: "summary",
			title,
			description: resolvedDescription,
		},
		robots: noIndex ? { index: false, follow: false } : getMetadataRobots(),
	};
}
