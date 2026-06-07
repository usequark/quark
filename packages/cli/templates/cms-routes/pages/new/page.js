import { cmsCreatePage } from "../../_actions/content";
import ContentForm from "../../_components/ContentForm";

export const metadata = { title: "New Page" };

export default function NewPagePage() {
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
						<span className="text-text-muted">New</span>
					</div>
					<h1 className="text-2xl font-bold text-text mt-1">New Page</h1>
				</div>
			</div>

			<ContentForm createAction={cmsCreatePage} modelLabel="Page" />
		</div>
	);
}
