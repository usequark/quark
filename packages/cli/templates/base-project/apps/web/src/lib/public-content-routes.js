import { loadCmsConfig } from "./load-cms-config.js";

export const RESERVED_ROOT_PUBLIC_SLUGS = Object.freeze([
	"admin",
	"api",
	"auth",
	"playground",
]);

const DEFAULT_SITEMAP_CONFIG = Object.freeze({
	changeFrequency: "weekly",
	priority: 0.8,
});

function normalizePathPrefix(pathPrefix = "") {
	return pathPrefix.replace(/^\/+|\/+$/g, "");
}

function normalizeSlug(slug) {
	return slug.replace(/^\/+|\/+$/g, "");
}

function normalizeReservedSlugs(slugs) {
	return [...new Set(slugs.map(normalizeSlug).filter(Boolean))];
}

export function createPublicContentRoute({
	model,
	pathPrefix = "",
	reservedSlugs,
	sitemap = {},
}) {
	const normalizedPrefix = normalizePathPrefix(pathPrefix);
	const normalizedReservedSlugs = normalizeReservedSlugs(
		reservedSlugs ?? (normalizedPrefix ? [] : [...RESERVED_ROOT_PUBLIC_SLUGS]),
	);

	return {
		model,
		pathPrefix: normalizedPrefix,
		routePattern: normalizedPrefix ? `/${normalizedPrefix}/[slug]` : "/[slug]",
		reservedSlugs: normalizedReservedSlugs,
		sitemap: {
			changeFrequency:
				sitemap.changeFrequency ?? DEFAULT_SITEMAP_CONFIG.changeFrequency,
			priority: sitemap.priority ?? DEFAULT_SITEMAP_CONFIG.priority,
		},
	};
}

function normalizePublicRouteConfig(model, publicRoute) {
	if (publicRoute === false) {
		return null;
	}

	if (!publicRoute || publicRoute === true) {
		return model === "Page" ? createPublicContentRoute({ model }) : null;
	}

	return createPublicContentRoute({
		model,
		pathPrefix: publicRoute.pathPrefix ?? publicRoute.basePath ?? "",
		reservedSlugs: publicRoute.reservedSlugs,
		sitemap: publicRoute.sitemap,
	});
}

export function normalizePublicContentRoutes(cmsConfig) {
	const contentTypes = cmsConfig?.contentTypes ?? {};
	const routes = [];
	let hasPageRouteConfig = false;

	for (const [model, config] of Object.entries(contentTypes)) {
		if (Object.hasOwn(config ?? {}, "publicRoute")) {
			hasPageRouteConfig = hasPageRouteConfig || model === "Page";

			const route = normalizePublicRouteConfig(model, config.publicRoute);
			if (route) {
				routes.push(route);
			}
			continue;
		}

		if (model === "Page") {
			hasPageRouteConfig = true;
			routes.push(createPublicContentRoute({ model }));
		}
	}

	if (!hasPageRouteConfig) {
		routes.unshift(createPublicContentRoute({ model: "Page" }));
	}

	return routes.sort((left, right) =>
		left.routePattern.localeCompare(right.routePattern),
	);
}

export async function getPublicContentRoutes() {
	const cmsConfig = await loadCmsConfig();
	return normalizePublicContentRoutes(cmsConfig);
}

export async function getPublicContentRouteByModel(modelName) {
	const routes = await getPublicContentRoutes();
	return routes.find((route) => route.model === modelName) ?? null;
}

export function getPublicContentPath(route, slug) {
	const normalizedSlug = normalizeSlug(slug);
	return route.pathPrefix
		? `/${route.pathPrefix}/${normalizedSlug}`
		: `/${normalizedSlug}`;
}

export function isReservedPublicSlug(route, slug) {
	return route.reservedSlugs.includes(normalizeSlug(slug));
}
