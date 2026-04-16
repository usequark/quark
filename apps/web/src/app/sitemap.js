import { getAppUrl } from "@techstream/quark-config";
import { isWebsiteIndexable } from "../lib/seo/indexing.js";

export const dynamic = "force-dynamic";

const STATIC_ROUTES = [{ path: "/", changeFrequency: "daily", priority: 1 }];

export default function sitemap() {
	if (!isWebsiteIndexable()) {
		return [];
	}

	const appUrl = getAppUrl();
	const lastModified = new Date();

	return STATIC_ROUTES.map((route) => ({
		url: `${appUrl}${route.path}`,
		lastModified,
		changeFrequency: route.changeFrequency,
		priority: route.priority,
	}));
}
