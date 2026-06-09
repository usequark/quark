import { getAppUrl } from "@techstream/quark-config";
import { STATIC_SITEMAP_ROUTES, buildSitemapEntries } from "../lib/sitemap-entries.js";
import { isWebsiteIndexable } from "../lib/seo/indexing.js";

export const revalidate = 3600;

export default async function sitemap() {
	if (!isWebsiteIndexable()) {
		return [];
	}

	const appUrl = getAppUrl();
	return buildSitemapEntries({ appUrl });
}
