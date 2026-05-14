import { prisma } from "@techstream/quark-db";
import { notFound } from "next/navigation";
import PageContentRenderer from "@/app/_components/PageContentRenderer";
import { requireRole } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";
export const metadata = {
	title: "Page Preview",
};

export default async function PreviewPagePage({ params }) {
	await requireRole(["admin", "editor"]);

	const { id } = await params;
	const record = await prisma.page.findUnique({
		where: { id },
		select: {
			title: true,
			excerpt: true,
			body: true,
			content: true,
			layout: true,
			status: true,
			slug: true,
		},
	});

	if (!record) {
		notFound();
	}

	return (
		<div className="space-y-6">
			<div className="rounded-[--radius-default] border border-border bg-surface px-5 py-4">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-faint">
							Admin Preview
						</p>
						<h1 className="mt-1 text-xl font-semibold text-text">
							{record.title}
						</h1>
						<p className="mt-1 text-sm text-text-muted">
							Previewing the saved {record.status.toLowerCase()} version in the
							admin area.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<a
							href={`/admin/cms/pages/${id}`}
							className="inline-flex h-10 items-center justify-center rounded-[--radius-default] border border-border bg-surface px-4 text-sm font-medium tracking-wide text-text-muted transition-all duration-200 linear hover:border-border-hover hover:text-text"
						>
							BACK TO EDITOR
						</a>
						{record.status === "PUBLISHED" && record.slug ? (
							<a
								href={`/${record.slug}`}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex h-10 items-center justify-center rounded-[--radius-default] border border-border bg-surface px-4 text-sm font-medium tracking-wide text-text-muted transition-all duration-200 linear hover:border-border-hover hover:text-text"
							>
								VIEW LIVE PAGE
							</a>
						) : null}
					</div>
				</div>
			</div>

			<div className="overflow-hidden rounded-[--radius-default] border border-border bg-surface shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
				<PageContentRenderer
					title={record.title}
					excerpt={record.excerpt}
					content={record.content}
					fallbackBody={record.body}
					layout={record.layout}
				/>
			</div>
		</div>
	);
}
