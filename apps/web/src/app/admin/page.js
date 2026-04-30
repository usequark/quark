import {
	adminConfig,
	countRecords,
	getModels,
	modelToSlug,
} from "@techstream/quark-admin";
import { prisma } from "@techstream/quark-db";
import {
	Badge,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@techstream/quark-ui";
import {
	getJobStats,
	getRecentJobs,
	getServiceHealth,
} from "./_lib/dashboard-data";

export default async function AdminDashboard() {
	const models = getModels();

	// Fetch everything in parallel
	const [counts, health, jobStats, recentJobs, cmsStats] = await Promise.all([
		Promise.allSettled(
			models.map(async (model) => ({
				name: model.name,
				slug: modelToSlug(model.name),
				count: await countRecords(prisma, model.name),
			})),
		),
		getServiceHealth(),
		getJobStats(),
		getRecentJobs(),
		getCmsStats(),
	]);

	const rows = counts
		.filter((r) => r.status === "fulfilled")
		.map((r) => r.value)
		.filter(({ name }) => !adminConfig.modelOverrides[name]?.readOnly);

	const JOB_STATUSES = [
		"PENDING",
		"IN_PROGRESS",
		"COMPLETED",
		"FAILED",
		"CANCELLED",
	];
	const STATUS_VARIANTS = {
		COMPLETED: "success",
		IN_PROGRESS: "info",
		PENDING: "warning",
		FAILED: "danger",
		CANCELLED: "default",
	};

	return (
		<div className="space-y-8">
			{/* Page header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-text">
					Dashboard
				</h1>
				<p className="mt-1 text-sm text-text-faint">
					System overview and application data
				</p>
			</div>

			{/* Service Status */}
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint mb-3">
					Service Status
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<ServiceCard
						name="PostgreSQL"
						icon={
							<svg
								aria-hidden="true"
								className="w-5 h-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
								/>
							</svg>
						}
						status={health.database.status}
						latencyMs={health.database.latencyMs}
						message={health.database.message}
					/>
					<ServiceCard
						name="Redis"
						icon={
							<svg
								aria-hidden="true"
								className="w-5 h-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
								/>
							</svg>
						}
						status={health.redis.status}
						latencyMs={health.redis.latencyMs}
						message={health.redis.message}
					/>
				</div>
			</section>

			{/* Worker Overview */}
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint mb-3">
					Worker Overview
				</h2>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{/* Job Queue Stats */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Job Queue</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
								{JOB_STATUSES.map((status) => (
									<div key={status} className="flex flex-col gap-1">
										<Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>
										<p className="text-2xl font-bold tabular-nums text-text">
											{jobStats.byStatus[status] ?? 0}
										</p>
									</div>
								))}
								<div className="flex flex-col gap-1">
									<span className="text-[10px] font-semibold uppercase tracking-widest text-text-faint">
										Total
									</span>
									<p className="text-2xl font-bold tabular-nums text-text">
										{jobStats.total}
									</p>
								</div>
							</div>

							{Object.keys(jobStats.byQueue).length > 0 && (
								<div className="mt-4 pt-4 border-t border-border">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-text-faint mb-2">
										By Queue
									</p>
									<div className="flex flex-wrap gap-3">
										{Object.entries(jobStats.byQueue).map(([queue, count]) => (
											<div
												key={queue}
												className="flex items-center gap-2 text-sm"
											>
												<span className="font-mono text-text-muted">
													{queue}
												</span>
												<span className="font-bold tabular-nums text-text">
													{count}
												</span>
											</div>
										))}
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Recent Jobs */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Recent Jobs</CardTitle>
						</CardHeader>
						<CardContent>
							{recentJobs.length === 0 ? (
								<p className="text-sm text-text-faint py-4 text-center">
									No jobs recorded
								</p>
							) : (
								<div className="overflow-auto -mx-6">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Name</TableHead>
												<TableHead>Queue</TableHead>
												<TableHead>Status</TableHead>
												<TableHead className="text-right">Time</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{recentJobs.map((job) => (
												<TableRow key={job.id}>
													<TableCell className="font-mono text-xs">
														{job.name}
													</TableCell>
													<TableCell className="text-text-muted text-xs">
														{job.queue}
													</TableCell>
													<TableCell>
														<Badge variant={STATUS_VARIANTS[job.status]}>
															{job.status}
														</Badge>
													</TableCell>
													<TableCell className="text-right text-xs text-text-muted tabular-nums">
														{formatTimeAgo(job.createdAt)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</section>

			{/* CMS Content */}
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint mb-3">
					Content
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<CmsStatCard
						label="Pages"
						href="/admin/cms/pages"
						published={cmsStats.pages.published}
						drafts={cmsStats.pages.drafts}
						total={cmsStats.pages.total}
					/>
					<CmsStatCard
						label="Media"
						href="/admin/cms/media"
						total={cmsStats.media}
					/>
				</div>
			</section>

			{/* Model Records */}
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint mb-3">
					Data Models
				</h2>
				{rows.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-[--radius-default] border border-border py-20 text-center">
						<p className="text-sm font-medium text-text-muted">
							No models found
						</p>
						<p className="mt-1 text-xs text-text-faint">
							Add models to your Prisma schema and run{" "}
							<code className="font-mono">pnpm db:migrate</code>
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{rows.map(({ name, slug, count }) => (
							<a key={name} href={`/admin/${slug}`} className="block group">
								<Card className="transition-colors hover:border-border-hover">
									<CardContent className="pt-6">
										<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
											{name}
										</p>
										<div className="mt-3 flex items-end justify-between">
											<p className="text-3xl font-bold tabular-nums text-text">
												{count}
											</p>
											<span className="mb-1 text-sm text-text-faint transition-colors group-hover:text-text">
												records →
											</span>
										</div>
									</CardContent>
								</Card>
							</a>
						))}
					</div>
				)}
			</section>
		</div>
	);
}

/**
 * Fetch CMS content counts.
 * @returns {Promise<{ pages: {total,published,drafts}, media: number }>}
 */
async function getCmsStats() {
	const [pagesTotal, pagesPublished, pagesDrafts, media] = await Promise.all([
		prisma.page.count(),
		prisma.page.count({ where: { status: "PUBLISHED" } }),
		prisma.page.count({ where: { status: "DRAFT" } }),
		prisma.mediaAsset.count(),
	]);
	return {
		pages: {
			total: pagesTotal,
			published: pagesPublished,
			drafts: pagesDrafts,
		},
		media,
	};
}

/**
 * CMS stat card linking to a CMS section.
 */
function CmsStatCard({ label, href, total, published, drafts }) {
	const isMedia = published === undefined;
	return (
		<a href={href} className="block group">
			<Card className="transition-colors hover:border-border-hover h-full">
				<CardContent className="pt-6 flex flex-col h-full">
					<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						{label}
					</p>
					<div className="mt-3 flex items-end justify-between">
						<p className="text-3xl font-bold tabular-nums text-text">{total}</p>
						<span className="mb-1 text-sm text-text-faint transition-colors group-hover:text-text">
							{isMedia ? "assets →" : "items →"}
						</span>
					</div>
					{!isMedia && (
						<div className="flex gap-3 mt-3 pt-3 border-t border-border">
							<span className="text-xs text-success tabular-nums">
								{published} published
							</span>
							<span className="text-xs text-text-faint tabular-nums">
								{drafts} draft
							</span>
						</div>
					)}
					{isMedia && <div className="mt-3 pt-3 border-t border-border" />}
				</CardContent>
			</Card>
		</a>
	);
}

/**
 * Service status card component.
 */
function ServiceCard({ name, icon, status, latencyMs, message }) {
	const isOk = status === "ok";
	return (
		<Card className={isOk ? "border-success/30" : "border-danger/30"}>
			<CardContent className="pt-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className={isOk ? "text-success" : "text-danger"}>{icon}</div>
						<div>
							<p className="text-sm font-semibold text-text">{name}</p>
							{isOk ? (
								<p className="text-xs text-text-faint tabular-nums">
									{latencyMs}ms latency
								</p>
							) : (
								<p className="text-xs text-danger">{message}</p>
							)}
						</div>
					</div>
					<Badge variant={isOk ? "success" : "danger"}>
						{isOk ? "Connected" : "Error"}
					</Badge>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Format a date as relative time.
 * @param {Date|string} date
 * @returns {string}
 */
function formatTimeAgo(date) {
	const now = Date.now();
	const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
	const diff = now - then;

	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}
