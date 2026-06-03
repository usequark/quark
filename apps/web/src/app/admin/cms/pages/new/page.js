import { cmsCreatePage } from "../../_actions/content";
import ContentForm from "../../_components/ContentForm";

export const metadata = { title: "New Page" };

export default function NewPagePage() {
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
								d="M12 4v16m8-8H4"
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
							<span className="text-text-muted">New</span>
						</div>
						<h1 className="text-2xl font-bold tracking-tight text-text mt-0.5">
							New Page
						</h1>
					</div>
				</div>
			</div>

			<ContentForm createAction={cmsCreatePage} modelLabel="Page" />
		</div>
	);
}
