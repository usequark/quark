import { prisma } from "@techstream/quark-db";
import { notFound } from "next/navigation";
import {
	cmsArchivePost,
	cmsDeletePost,
	cmsPublishPost,
	cmsUnpublishPost,
	cmsUpdatePost,
} from "../../../_actions/content";
import ContentForm from "../../../_components/ContentForm";

export const metadata = { title: "CMS — Edit Post" };

export default async function EditPostPage({ params }) {
	const { id } = await params;

	const record = await prisma.post.findUnique({ where: { id } });
	if (!record) notFound();

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/cms/posts"
					className="text-sm text-text-faint hover:text-text"
				>
					← Posts
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">Edit Post</h1>
			</div>
			<ContentForm
				record={record}
				updateAction={cmsUpdatePost.bind(null, id)}
				publishAction={cmsPublishPost.bind(null, id)}
				archiveAction={cmsArchivePost.bind(null, id)}
				unpublishAction={cmsUnpublishPost.bind(null, id)}
				deleteAction={cmsDeletePost.bind(null, id)}
				hasCoverImage
				modelLabel="Post"
			/>
		</div>
	);
}
