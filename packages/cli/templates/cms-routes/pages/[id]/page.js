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

export const metadata = { title: "CMS — Edit Page" };

export default async function EditPagePage({ params }) {
	const { id } = await params;

	const record = await prisma.page.findUnique({ where: { id } });
	if (!record) notFound();

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/cms/pages"
					className="text-sm text-text-faint hover:text-text"
				>
					← Pages
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">Edit Page</h1>
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
