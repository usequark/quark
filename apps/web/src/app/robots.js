import { getAppUrl } from "@techstream/quark-config";
import { headers } from "next/headers";
import { isWebsiteIndexable } from "../lib/seo/indexing.js";

export const dynamic = "force-dynamic";

export default async function robots() {
	await headers();
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
