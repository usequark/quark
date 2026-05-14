import { prisma } from "@techstream/quark-db";
import { notFound } from "next/navigation";
import PageContentRenderer from "../_components/PageContentRenderer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
	const { slug } = await params;
	const page = await prisma.page.findFirst({
		where: { slug, status: "PUBLISHED" },
		select: {
			title: true,
			excerpt: true,
		},
	});

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
	const page = await prisma.page.findFirst({
		where: { slug, status: "PUBLISHED" },
		select: {
			title: true,
			excerpt: true,
			body: true,
			content: true,
			layout: true,
		},
	});

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
