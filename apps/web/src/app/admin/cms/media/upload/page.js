"use client";

import { ChevronLeft } from "lucide-react";
import { cmsUploadMedia } from "../../_actions/media";
import MediaEditorForm from "../_components/MediaEditorForm";

export default function MediaUploadPage() {
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
				<h1 className="text-2xl font-bold mt-1 text-text">Upload Media</h1>
			</div>
			<MediaEditorForm mode="upload" submitAction={cmsUploadMedia} />
		</div>
	);
}
