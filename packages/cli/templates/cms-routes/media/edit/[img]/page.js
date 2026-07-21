import { prisma } from "@techstream/quark-db";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { cmsDeleteMedia, cmsUpdateMedia } from "../../../_actions/media";
import MediaEditorForm from "../../_components/MediaEditorForm";

export async function generateMetadata({ params }) {
	const { img } = await params;
	const asset = await prisma.mediaAsset.findUnique({
		where: { id: img },
		select: { filename: true },
	});

	return { title: asset ? `Edit: ${asset.filename}` : "Edit Media" };
}

export default async function MediaEditPage({ params }) {
	const { img } = await params;
	const asset = await prisma.mediaAsset.findUnique({
		where: { id: img },
	});

	if (!asset) notFound();

	return (
		<div className="max-w-6xl mx-auto">
			<div className="mb-6">
				<a
					href="/admin/cms/media"
					className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text bg-surface border border-border hover:border-border-hover px-3 py-1.5 rounded-[--radius-default] transition-colors mb-2"
				>
					<ChevronLeft size={15} />
					Media Library
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">Edit Media</h1>
			</div>
			<MediaEditorForm
				mode="edit"
				asset={asset}
				submitAction={cmsUpdateMedia.bind(null, img)}
				deleteAction={cmsDeleteMedia.bind(null, img)}
			/>
		</div>
	);
}
