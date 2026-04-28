import { getAppUrl } from "@techstream/quark-config";
import { isWebsiteIndexable } from "../lib/seo/indexing.js";

export const dynamic = "force-dynamic";

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
