import { notFound } from "next/navigation";
import {
	getPublishedPageBySlug,
	getPublishedPageSlugs,
} from "@/lib/public-content.js";
import PageContentRenderer from "../_components/PageContentRenderer";
import PublicLayout from "../_components/PublicLayout";

export const revalidate = 3600;

export async function generateStaticParams() {
	try {
		const records = await getPublishedPageSlugs();
		return records.map(({ slug }) => ({ slug }));
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("Missing required database environment variables")
		) {
			// CI build jobs may not expose DB credentials; skip prerender params.
			return [];
		}

		// Railway build network can't reach postgres.railway.internal,
		// and local builds may not have a running Postgres.
		// Skip pre-rendering; the page will render on-demand via ISR.
		const { Prisma } = await import("@techstream/quark-db");
		const isConnectionError =
			error instanceof Prisma.PrismaClientInitializationError ||
			(error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code?.startsWith("P1"));
		if (isConnectionError) {
			return [];
		}

		throw error;
	}
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
		<PublicLayout>
			<PageContentRenderer
				title={page.title}
				excerpt={page.excerpt}
				content={page.content}
				fallbackBody={page.body}
				layout={page.layout}
				showHeader={page.showHeader}
			/>
		</PublicLayout>
	);
}
