import { notFound } from "next/navigation";
import {
	getPublishedPageBySlug,
	getPublishedPageSlugs,
} from "@/lib/public-content.js";
import PageContentRenderer from "../_components/PageContentRenderer";

export const revalidate = 3600;

export async function generateStaticParams() {
	const records = await getPublishedPageSlugs();
	return records.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const page = await getPublishedPageBySlug(slug);

	if (!page) {
		return {};
	}

	return {
		title: page.title,
		description: page.excerpt || undefined,
	};
}

export default async function PublishedPage({ params }) {
	const { slug } = await params;
	const page = await getPublishedPageBySlug(slug);

	if (!page) {
		notFound();
	}

	return (
		<main className="min-h-screen bg-bg text-text">
			<PageContentRenderer
				title={page.title}
				excerpt={page.excerpt}
				content={page.content}
				fallbackBody={page.body}
				layout={page.layout}
			/>
		</main>
	);
}
