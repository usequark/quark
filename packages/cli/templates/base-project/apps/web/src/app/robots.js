import { getAppUrl } from "@techstream/quark-config";
import { isWebsiteIndexable } from "../lib/seo/indexing.js";

export default function robots() {
	const appUrl = getAppUrl();
	const indexable = isWebsiteIndexable();

	return {
		rules: indexable
			? {
					userAgent: "*",
					allow: "/",
					disallow: ["/api/"],
				}
			: {
					userAgent: "*",
					disallow: "/",
				},
		sitemap: indexable ? `${appUrl}/sitemap.xml` : undefined,
	};
}
