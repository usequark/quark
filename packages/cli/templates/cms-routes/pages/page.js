import { prisma } from "@techstream/quark-db";
import { Button } from "@techstream/quark-ui";
import ContentTable from "../_components/ContentTable";

export const metadata = { title: "Pages" };

const STATUS_FILTERS = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function PagesListPage({ searchParams }) {
	const { status = "ALL" } = await searchParams;
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
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>
					<div className="flex-1">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold tracking-tight text-text">
									Pages
								</h1>
								<p className="mt-0.5 text-sm text-text-faint">
									{total} page{total !== 1 ? "s" : ""}
									{status !== "ALL" ? ` \u00b7 ${status.toLowerCase()}` : ""}
								</p>
							</div>
							<a href="/admin/cms/pages/new">
								<Button>New Page</Button>
							</a>
						</div>
					</div>
				</div>
			</div>

			{/* Status filter tabs */}
			<div className="flex gap-1 border-b border-border">
				{STATUS_FILTERS.map((f) => (
					<a
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
					</a>
				))}
			</div>

			<ContentTable records={records} basePath="/admin/cms/pages" />
			{total > 50 && (
				<p className="mt-3 text-xs text-text-faint text-center tabular-nums">
					Showing 50 of {total} — use status filters to narrow results.
				</p>
			)}
		</div>
	);
}
