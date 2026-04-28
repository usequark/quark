import { cmsConfig } from "@techstream/quark-cms";
import { prisma } from "@techstream/quark-db";
import {
	Badge,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@techstream/quark-ui";
import Image from "next/image";

export const metadata = { title: "CMS — Content Overview" };

export default async function CmsDashboard() {
	const contentTypes = Object.entries(cmsConfig.contentTypes);

	// Fetch counts per model per status in parallel
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
	const recentMedia = await prisma.mediaAsset.findMany({
		orderBy: { createdAt: "desc" },
		take: 4,
	});

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-text">Content</h1>
				<p className="mt-1 text-sm text-text-faint">
					Manage pages, posts, and media
				</p>
			</div>

			{/* Content type stats */}
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint mb-3">
					Content Types
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{stats.map(({ model, label, total, drafts, published, archived }) => (
						<a
							key={model}
							href={`/admin/cms/${model.toLowerCase()}s`}
							className="block group"
						>
							<Card className="transition-colors hover:border-border-hover">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-semibold text-text-muted uppercase tracking-widest">
										{label}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-3xl font-bold tabular-nums text-text mb-3">
										{total}
									</p>
									<div className="flex flex-wrap gap-2">
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
					<a href="/admin/cms/media" className="block group">
						<Card className="transition-colors hover:border-border-hover">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-semibold text-text-muted uppercase tracking-widest">
									Media Library
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-3xl font-bold tabular-nums text-text mb-3">
									{mediaCount}
								</p>
								<p className="text-xs text-text-faint">assets uploaded</p>
							</CardContent>
						</Card>
					</a>
				</div>
			</section>

			{/* Recent media */}
			{recentMedia.length > 0 && (
				<section>
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Recent Media
						</h2>
						<a
							href="/admin/cms/media"
							className="text-xs text-primary hover:opacity-75"
						>
							View all →
						</a>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						{recentMedia.map((asset) => (
							<div
								key={asset.id}
								className="relative rounded-[--radius-default] border border-border bg-surface-hover overflow-hidden aspect-square flex items-center justify-center"
							>
								{asset.mimeType.startsWith("image/") ? (
									<Image
										fill
										src={`/api/media/${asset.storageKey}`}
										alt={asset.alt ?? asset.filename}
										className="object-cover"
										sizes="(max-width: 640px) 50vw, 25vw"
									/>
								) : (
									<div className="text-center p-2">
										<p className="text-xs font-mono text-text-muted truncate">
											{asset.filename}
										</p>
										<p className="text-[10px] text-text-faint mt-1">
											{asset.mimeType}
										</p>
									</div>
								)}
							</div>
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
			<Badge variant={variant}>{label}</Badge>
			<span className="text-sm font-semibold tabular-nums text-text">
				{count}
			</span>
		</div>
	);
}

function getDelegate(prisma, model) {
	const key = model.charAt(0).toLowerCase() + model.slice(1);
	return prisma[key];
}
