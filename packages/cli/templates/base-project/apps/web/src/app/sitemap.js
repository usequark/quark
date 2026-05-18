import { getAppUrl } from "@techstream/quark-config";
import { getPublicContentSitemapEntries } from "../lib/public-content.js";
import { isWebsiteIndexable } from "../lib/seo/indexing.js";
import { buildSitemapEntries } from "../lib/sitemap-entries.js";

export const revalidate = 3600;

export default async function sitemap() {
	if (!isWebsiteIndexable()) {
		return [];
	}

	const appUrl = getAppUrl();
	const publicContentEntries = await getPublicContentSitemapEntries();

	return buildSitemapEntries({ appUrl, publicContentEntries });
}
