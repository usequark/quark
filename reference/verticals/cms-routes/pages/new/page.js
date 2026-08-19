import { ChevronLeft } from "lucide-react";
import { cmsCreatePage } from "../../_actions/content";
import ContentForm from "../../_components/ContentForm";

export const metadata = { title: "New Page" };

export default function NewPagePage() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<a
						href="/admin/cms/pages"
						className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text bg-surface border border-border hover:border-border-hover px-3 py-1.5 rounded-[--radius-default] transition-colors mb-2"
					>
						<ChevronLeft size={15} />
						Pages
					</a>
					<h1 className="text-2xl font-bold text-text mt-1">New Page</h1>
				</div>
			</div>

			<ContentForm createAction={cmsCreatePage} modelLabel="Page" />
		</div>
	);
}
