import { cmsCreatePost } from "../../_actions/content";
import ContentForm from "../../_components/ContentForm";

export const metadata = { title: "CMS — New Post" };

export default function NewPostPage() {
	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/cms/posts"
					className="text-sm text-text-faint hover:text-text"
				>
					← Posts
				</a>
				<h1 className="text-2xl font-bold mt-1 text-text">New Post</h1>
			</div>
			<ContentForm
				createAction={cmsCreatePost}
				hasCoverImage
				modelLabel="Post"
			/>
		</div>
	);
}
