import { cmsConfig } from "@techstream/quark-cms";
import { prisma } from "@techstream/quark-db";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@techstream/quark-ui";
import MediaAssetCard from "./_components/MediaAssetCard";
import StatusBadge from "./_components/StatusBadge";

export const metadata = { title: "Content Overview" };

export default async function CmsDashboard() {
	const contentTypes = Object.entries(cmsConfig.contentTypes);

	const stats = await Promise.all(
		contentTypes.map(async ([model, cfg]) => {
			const delegate = getDelegate(prisma, model);
			const [total, drafts, published, archived] = await Promise.all([
				delegate.count(),
				delegate.count({ where: { status: "DRAFT" } }),
				delegate.count({ where: { status: "PUBLISHED" } }),
				delegate.count({ where: { status: "ARCHIVED" } }),
			]);
			return { model, label: cfg.label, total, drafts, published, archived };
		}),
	);

	const mediaCount = await prisma.mediaAsset.count();
	const [recentMedia, recentPages] = await Promise.all([
		prisma.mediaAsset.findMany({
			orderBy: { createdAt: "desc" },
			take: 4,
			select: {
				id: true,
				filename: true,
				storageKey: true,
				mimeType: true,
				size: true,
				alt: true,
			},
		}),
		prisma.page.findMany({
			orderBy: { updatedAt: "desc" },
			take: 5,
			select: {
				id: true,
				title: true,
				slug: true,
				status: true,
			},
		}),
	]);

	return (
		<div className="space-y-10">
			{/* ── Page header ── */}
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
								d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
							/>
						</svg>
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-text">
							Content
						</h1>
						<p className="mt-0.5 text-sm text-text-faint">
							Manage pages and media
						</p>
					</div>
				</div>
			</div>

			{/* ── Sub-nav ── */}
			<div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
				<a
					href="/admin/cms"
					className="border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text"
				>
					Overview
				</a>
				<a
					href="/admin/cms/pages"
					className="border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
				>
					Pages
				</a>
				<a
					href="/admin/cms/media"
					className="border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
				>
					Media
				</a>
				<div className="ml-auto">
					<a href="/admin/cms/pages/new">
						<Button size="sm">New Page</Button>
					</a>
				</div>
			</div>

			{/* ── Content Types ── */}
			<section>
				<div className="mb-4 flex items-center gap-3">
					<div className="h-px flex-1 bg-border" />
					<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						Content Types
					</h2>
					<div className="h-px flex-1 bg-border" />
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
					{stats.map(({ model, label, total, drafts, published, archived }) => (
						<a
							key={model}
							href={`/admin/cms/${model.toLowerCase()}s`}
							className="block group h-full"
						>
							<Card className="transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_24px_-4px_rgba(55,125,255,0.12)] h-full flex flex-col">
								<div className="h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" />
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-semibold text-text-muted uppercase tracking-widest">
										{label}
									</CardTitle>
								</CardHeader>
								<CardContent className="flex flex-col flex-1">
									<p className="text-3xl font-bold tabular-nums text-text mb-3">
										{total}
									</p>
									<div className="flex flex-wrap gap-2 mt-auto">
										<StatusChip
											label="Published"
											count={published}
											variant="success"
										/>
										<StatusChip
											label="Draft"
											count={drafts}
											variant="warning"
										/>
										<StatusChip
											label="Archived"
											count={archived}
											variant="default"
										/>
									</div>
								</CardContent>
							</Card>
						</a>
					))}

					{/* Media card */}
					<a href="/admin/cms/media" className="block group h-full">
						<Card className="transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_24px_-4px_rgba(55,125,255,0.12)] h-full flex flex-col">
							<div className="h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" />
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-semibold text-text-muted uppercase tracking-widest">
									Media Library
								</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col flex-1">
								<p className="text-3xl font-bold tabular-nums text-text mb-3">
									{mediaCount}
								</p>
								<p className="text-xs text-text-faint mt-auto">
									{mediaCount === 0 ? "No assets yet" : "assets uploaded"}
								</p>
							</CardContent>
						</Card>
					</a>
				</div>
			</section>

			{/* ── Recent Media ── */}
			{recentMedia.length > 0 && (
				<section>
					<div className="mb-4 flex items-center gap-3">
						<div className="h-px flex-1 bg-border" />
						<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Recent Media
						</h2>
						<div className="h-px flex-1 bg-border" />
					</div>
					<div className="flex items-center justify-end mb-3">
						<a
							href="/admin/cms/media"
							className="text-xs text-primary hover:opacity-75"
						>
							View all &rarr;
						</a>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						{recentMedia.map((asset) => {
							return (
								<MediaAssetCard
									key={asset.id}
									asset={asset}
									href="/admin/cms/media"
								/>
							);
						})}
					</div>
				</section>
			)}

			{/* ── Recent Pages ── */}
			{recentPages.length > 0 && (
				<section>
					<div className="mb-4 flex items-center gap-3">
						<div className="h-px flex-1 bg-border" />
						<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Recent Pages
						</h2>
						<div className="h-px flex-1 bg-border" />
					</div>
					<div className="flex items-center justify-end mb-3">
						<a
							href="/admin/cms/pages"
							className="text-xs text-primary hover:opacity-75"
						>
							View all &rarr;
						</a>
					</div>
					<div className="border border-border bg-surface divide-y divide-border">
						{recentPages.map((page) => (
							<a
								key={page.id}
								href={`/admin/cms/pages/${page.id}`}
								className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
							>
								<div className="min-w-0 mr-3">
									<p className="text-sm font-medium text-text truncate">
										{page.title}
									</p>
									<p className="text-[10px] text-text-faint font-mono truncate">
										/{page.slug}
									</p>
								</div>
								<StatusBadge status={page.status} />
							</a>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

function StatusChip({ label, count, variant }) {
	return (
		<div className="flex items-center gap-1.5">
			<span className="text-sm font-semibold tabular-nums text-text">
				{count}
			</span>
			<Badge variant={variant}>{label}</Badge>
		</div>
	);
}

function getDelegate(prisma, model) {
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	return prisma[key];
}
