export const STATIC_SITEMAP_ROUTES = [
	{ path: "/", changeFrequency: "daily", priority: 1 },
];

export function buildSitemapEntries({
	appUrl,
	staticRoutes = STATIC_SITEMAP_ROUTES,
	publicContentEntries = [],
}) {
	return [
		...staticRoutes.map((route) => ({
			url: `${appUrl}${route.path}`,
			changeFrequency: route.changeFrequency,
			priority: route.priority,
		})),
		...publicContentEntries.map((entry) => ({
			url: `${appUrl}${entry.path}`,
			changeFrequency: entry.changeFrequency,
			priority: entry.priority,
		})),
	];
}
