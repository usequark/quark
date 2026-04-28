import { cmsCreatePage } from "../../_actions/content";
import ContentForm from "../../_components/ContentForm";

export const metadata = { title: "CMS — New Page" };

export default function NewPagePage() {
	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/cms/pages"
					className="text-sm text-text-faint hover:text-text"
				>
					← Pages
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">New Page</h1>
			</div>
			<ContentForm createAction={cmsCreatePage} modelLabel="Page" />
		</div>
	);
}
