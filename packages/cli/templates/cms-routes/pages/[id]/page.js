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
			<div className="relative overflow-hidden border border-border bg-surface p-6 sm:p-8">
				<div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent" />
				<div className="relative flex items-center gap-4">
					<div className="flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary-muted">
						<svg
							aria-hidden="true"
							className="h-5 w-5 text-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
							/>
						</svg>
					</div>
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
						<h1 className="text-2xl font-bold tracking-tight text-text mt-0.5">
							Edit Page
						</h1>
					</div>
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
