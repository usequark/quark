import { prisma } from "@techstream/quark-db";
import { Button } from "@techstream/quark-ui";
import Link from "next/link";
import AdminActionToast from "../../_components/AdminActionToast";
import ContentTable from "../_components/ContentTable";

export const metadata = { title: "Pages" };

const STATUS_FILTERS = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function PagesListPage({ searchParams }) {
	const { status = "ALL", toast } = await searchParams;
	const where = status !== "ALL" ? { status } : undefined;

	const [records, total, draftCount, publishedCount, archivedCount] =
		await Promise.all([
			prisma.page.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				take: 50,
			}),
			prisma.page.count({ where }),
			prisma.page.count({ where: { status: "DRAFT" } }),
			prisma.page.count({ where: { status: "PUBLISHED" } }),
			prisma.page.count({ where: { status: "ARCHIVED" } }),
		]);
	const statusCounts = {
		ALL: draftCount + publishedCount + archivedCount,
		DRAFT: draftCount,
		PUBLISHED: publishedCount,
		ARCHIVED: archivedCount,
	};

	return (
		<div className="space-y-8">
			<AdminActionToast toastKey={toast} resourceLabel="Page" />
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-text">Pages</h1>
					<p className="text-sm text-text-faint mt-1">
						{total} page{total !== 1 ? "s" : ""}
						{status !== "ALL" ? ` \u00b7 ${status.toLowerCase()}` : ""}
					</p>
				</div>
				<Link href="/admin/cms/pages/new">
					<Button>New Page</Button>
				</Link>
			</div>

			{/* Status filter tabs */}
			<div className="flex gap-1 border-b border-border">
				{STATUS_FILTERS.map((f) => (
					<Link
						key={f}
						href={
							f === "ALL" ? "/admin/cms/pages" : `/admin/cms/pages?status=${f}`
						}
						className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
							status === f || (f === "ALL" && status === "ALL")
								? "border-primary text-text"
								: "border-transparent text-text-muted hover:text-text"
						}`}
					>
						{f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
						{statusCounts[f] > 0 && (
							<span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-xs tabular-nums">
								{statusCounts[f]}
							</span>
						)}
					</Link>
				))}
			</div>

			<ContentTable records={records} basePath="/admin/cms/pages" />
			{total > 50 && (
				<p className="mt-3 text-xs text-text-faint text-center tabular-nums">
					Showing 50 of {total} - use status filters to narrow results.
				</p>
			)}
		</div>
	);
}
