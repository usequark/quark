import { prisma } from "@techstream/quark-db";
import { unstable_cache } from "next/cache";
import {
	getPublicContentPath,
	getPublicContentRouteByModel,
	getPublicContentRoutes,
	isReservedPublicSlug,
} from "./public-content-routes.js";

export const PUBLIC_CONTENT_TAG = "public-content";
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 3600;
const PAGE_MODEL = "Page";

const loadPublishedPageBySlug = unstable_cache(
	async (slug) =>
		prisma.page.findFirst({
			where: { slug, status: "PUBLISHED" },
			select: {
				title: true,
				slug: true,
				excerpt: true,
				body: true,
				content: true,
				layout: true,
			},
		}),
	["public-content", "page-by-slug"],
	{
		revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
		tags: [PUBLIC_CONTENT_TAG, "public-pages"],
	},
);

const loadPublishedSlugsForModel = unstable_cache(
	async (model) =>
		getPublicContentDelegate(model).findMany({
			where: { status: "PUBLISHED" },
			select: { slug: true },
			orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
		}),
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
	return loadPublishedPageBySlug(slug);
}

export async function getPublishedPageSlugs() {
	const [route, records] = await Promise.all([
		getPublicContentRouteByModel(PAGE_MODEL),
		loadPublishedSlugsForModel(PAGE_MODEL),
	]);

	return records.filter(
		(record) => !route || !isReservedPublicSlug(route, record.slug),
	);
}

export async function getPublicContentSitemapEntries() {
	const routes = await getPublicContentRoutes();
	const entryGroups = await Promise.all(
		routes.map(async (route) => {
			const records = await loadPublishedSlugsForModel(route.model);

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
