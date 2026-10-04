import { getAppUrl } from "@usequark/quark-config";
import { isWebsiteIndexable } from "../lib/seo/indexing.js";

export const revalidate = 3600;

export default function robots() {
	const appUrl = getAppUrl();
	const indexable = isWebsiteIndexable();

	return {
		rules: indexable
			? {
					userAgent: "*",
					allow: "/",
					disallow: ["/api/", "/admin/", "/auth/"],
				}
			: {
					userAgent: "*",
					disallow: "/",
				},
		sitemap: indexable ? `${appUrl}/sitemap.xml` : undefined,
	};
}
