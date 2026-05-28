import { prisma } from "@techstream/quark-db";
import { unstable_cache } from "next/cache";
import { loadPublishedResultWithFallback } from "./public-content-cache.js";
import {
	getPublicContentPath,
	getPublicContentRouteByModel,
	getPublicContentRoutes,
	isReservedPublicSlug,
} from "./public-content-routes.js";

export const PUBLIC_CONTENT_TAG = "public-content";
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 3600;
const PAGE_MODEL = "Page";
const PUBLISHED_PAGE_SELECT = {
	title: true,
	slug: true,
	excerpt: true,
	body: true,
	content: true,
	layout: true,
	showHeader: true,
};
const PUBLISHED_SLUG_QUERY = {
	where: { status: "PUBLISHED" },
	select: { slug: true },
	orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
};

async function fetchPublishedPageBySlug(slug) {
	return prisma.page.findFirst({
		where: { slug, status: "PUBLISHED" },
		select: PUBLISHED_PAGE_SELECT,
	});
}

async function fetchPublishedSlugsForModel(model) {
	return getPublicContentDelegate(model).findMany(PUBLISHED_SLUG_QUERY);
}

const loadPublishedPageBySlug = unstable_cache(
	fetchPublishedPageBySlug,
	["public-content", "page-by-slug"],
	{
		revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
		tags: [PUBLIC_CONTENT_TAG, "public-pages"],
	},
);

const loadPublishedSlugsForModel = unstable_cache(
	fetchPublishedSlugsForModel,
	["public-content", "published-slugs-by-model"],
	{
		revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
		tags: [PUBLIC_CONTENT_TAG],
	},
);

function getPublicContentDelegate(model) {
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	return prisma[key];
}

export async function getPublishedPageBySlug(slug) {
	return loadPublishedResultWithFallback(slug, {
		loadCached: loadPublishedPageBySlug,
		loadDirect: fetchPublishedPageBySlug,
	});
}

export async function getPublishedPageSlugs() {
	const [route, records] = await Promise.all([
		getPublicContentRouteByModel(PAGE_MODEL),
		loadPublishedResultWithFallback(PAGE_MODEL, {
			loadCached: loadPublishedSlugsForModel,
			loadDirect: fetchPublishedSlugsForModel,
		}),
	]);

	return records.filter(
		(record) => !route || !isReservedPublicSlug(route, record.slug),
	);
}

export async function getPublicContentSitemapEntries() {
	const routes = await getPublicContentRoutes();
	const entryGroups = await Promise.all(
		routes.map(async (route) => {
			const records = await loadPublishedResultWithFallback(route.model, {
				loadCached: loadPublishedSlugsForModel,
				loadDirect: fetchPublishedSlugsForModel,
			});

			return records
				.filter((record) => !isReservedPublicSlug(route, record.slug))
				.map(({ slug }) => ({
					path: getPublicContentPath(route, slug),
					changeFrequency: route.sitemap.changeFrequency,
					priority: route.sitemap.priority,
				}));
		}),
	);

	return entryGroups.flat();
}
