import { prisma } from "@techstream/quark-db";
import { Button } from "@techstream/quark-ui";
import ContentTable from "../_components/ContentTable";

export const metadata = { title: "CMS — Blog Posts" };

const STATUS_FILTERS = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function PostsListPage({ searchParams }) {
	const { status = "ALL" } = await searchParams;
	const where = status !== "ALL" ? { status } : undefined;

	const [records, total] = await Promise.all([
		prisma.post.findMany({
			where,
			orderBy: { updatedAt: "desc" },
			take: 50,
		}),
		prisma.post.count({ where }),
	]);

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-text">Blog Posts</h1>
					<p className="text-sm text-text-faint mt-1">
						{total} post{total !== 1 ? "s" : ""}
						{status !== "ALL" ? ` · ${status}` : ""}
					</p>
				</div>
				<a href="/admin/cms/posts/new">
					<Button>New Post</Button>
				</a>
			</div>

			{/* Status filter tabs */}
			<div className="flex gap-1 mb-4 border-b border-border">
				{STATUS_FILTERS.map((f) => (
					<a
						key={f}
						href={
							f === "ALL" ? "/admin/cms/posts" : `/admin/cms/posts?status=${f}`
						}
						className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
							status === f || (f === "ALL" && status === "ALL")
								? "border-primary text-text"
								: "border-transparent text-text-muted hover:text-text"
						}`}
					>
						{f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
					</a>
				))}
			</div>

			<ContentTable records={records} basePath="/admin/cms/posts" />
		</div>
	);
}
