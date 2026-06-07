import { prisma } from "@techstream/quark-db";
import { notFound } from "next/navigation";
import {
	cmsArchivePage,
	cmsDeletePage,
	cmsPublishPage,
	cmsUnpublishPage,
	cmsUpdatePage,
} from "../../_actions/content";
import ContentForm from "../../_components/ContentForm";

export async function generateMetadata({ params }) {
	const { id } = await params;
	const record = await prisma.page.findUnique({
		where: { id },
		select: { title: true },
	});
	return { title: record ? `Edit: ${record.title}` : "Edit Page" };
}

export default async function EditPagePage({ params }) {
	const { id } = await params;

	const record = await prisma.page.findUnique({ where: { id } });
	if (!record) notFound();

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<div className="flex items-center gap-2 text-sm text-text-faint">
						<a
							href="/admin/cms/pages"
							className="hover:text-text transition-colors"
						>
							Pages
						</a>
						<span aria-hidden="true">/</span>
						<span className="text-text-muted">Edit</span>
					</div>
					<h1 className="text-2xl font-bold text-text mt-1">Edit Page</h1>
				</div>
			</div>

			<ContentForm
				record={record}
				updateAction={cmsUpdatePage.bind(null, id)}
				publishAction={cmsPublishPage.bind(null, id)}
				archiveAction={cmsArchivePage.bind(null, id)}
				unpublishAction={cmsUnpublishPage.bind(null, id)}
				deleteAction={cmsDeletePage.bind(null, id)}
				modelLabel="Page"
			/>
		</div>
	);
}
