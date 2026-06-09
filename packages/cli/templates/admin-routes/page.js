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
import { ChevronRight } from "lucide-react";
import { hasCmsFeature } from "@/lib/load-cms-config";
import {
	getJobStats,
	getRecentJobs,
	getServiceHealth,
} from "./_lib/dashboard-data";

export default async function AdminDashboard() {
	const models = getModels();
	const cmsEnabled = await hasCmsFeature();

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
		cmsEnabled ? getCmsStats() : Promise.resolve(null),
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
		<div className="space-y-10">
			{/* ── Page header ── */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold text-text">Dashboard</h1>
					<p className="text-sm text-text-faint mt-1">
						System overview and application data
					</p>
				</div>
			</div>

			{/* ── Service Status ── */}
			<section>
				<div className="mb-4 flex items-center gap-3">
					<div className="h-px flex-1 bg-border" />
					<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						Service Status
					</h2>
					<div className="h-px flex-1 bg-border" />
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<ServiceCard
						name="PostgreSQL"
						icon={
							<svg
								aria-hidden="true"
								className="h-5 w-5"
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
								className="h-5 w-5"
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

			{/* ── Worker Overview ── */}
			<section>
				<div className="mb-4 flex items-center gap-3">
					<div className="h-px flex-1 bg-border" />
					<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						Worker Overview
					</h2>
					<div className="h-px flex-1 bg-border" />
				</div>
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Job Queue</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
								{JOB_STATUSES.map((status) => (
									<div
										key={status}
										className="border border-border bg-bg/50 p-3"
									>
										<Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>
										<p className="mt-2 text-2xl font-bold tabular-nums text-text">
											{jobStats.byStatus[status] ?? 0}
										</p>
									</div>
								))}
								<div className="border border-border bg-bg/50 p-3">
									<span className="text-[10px] font-semibold uppercase tracking-widest text-text-faint">
										Total
									</span>
									<p className="mt-2 text-2xl font-bold tabular-nums text-text">
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
								<div className="overflow-auto">
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

			{/* ── Content ── */}
			{cmsStats && (
				<section>
					<div className="mb-4 flex items-center gap-3">
						<div className="h-px flex-1 bg-border" />
						<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Content
						</h2>
						<div className="h-px flex-1 bg-border" />
					</div>
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
			)}

			{/* ── Data Models ── */}
			<section>
				<div className="mb-4 flex items-center gap-3">
					<div className="h-px flex-1 bg-border" />
					<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						Data Models
					</h2>
					<div className="h-px flex-1 bg-border" />
				</div>
				{rows.length === 0 ? (
					<div className="flex flex-col items-center justify-center border border-border py-20 text-center">
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
								<Card className="transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_24px_-4px_rgba(55,125,255,0.12)]">
									<div className="h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" />
									<CardContent className="pt-5">
										<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
											{name}
										</p>
										<div className="mt-3 flex items-end justify-between">
											<p className="text-3xl font-bold tabular-nums text-text">
												{count}
											</p>
											<span className="inline-flex items-center gap-0.5 text-sm text-text-muted transition-colors group-hover:text-text">
												records
												<ChevronRight size={15} />
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

function CmsStatCard({ label, href, total, published, drafts }) {
	const isMedia = published === undefined;
	return (
		<a href={href} className="block group">
			<Card className="transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_24px_-4px_rgba(55,125,255,0.12)] h-full">
				<div className="h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" />
				<CardContent className="pt-5 flex flex-col h-full">
					<p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
						{label}
					</p>
					<div className="mt-3 flex items-end justify-between">
						<p className="text-3xl font-bold tabular-nums text-text">{total}</p>
						<span className="inline-flex items-center gap-0.5 text-sm text-text-muted transition-colors group-hover:text-text">
							{isMedia ? "assets" : "items"}
							<ChevronRight size={15} />
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
				</CardContent>
			</Card>
		</a>
	);
}

function ServiceCard({ name, icon, status, latencyMs, message }) {
	const isOk = status === "ok";
	return (
		<Card
			className={`relative overflow-hidden transition-all duration-200 hover:shadow-[0_0_24px_-4px_rgba(55,125,255,0.08)] ${
				isOk ? "border-success/20" : "border-danger/20"
			}`}
		>
			<div
				className={`absolute inset-x-0 top-0 h-0.5 ${
					isOk
						? "bg-gradient-to-r from-success/60 to-success/20"
						: "bg-gradient-to-r from-danger/60 to-danger/20"
				}`}
			/>
			<CardContent className="pt-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className={`flex h-10 w-10 items-center justify-center border ${
								isOk
									? "border-success/20 bg-success-muted text-success"
									: "border-danger/20 bg-danger-muted text-danger"
							}`}
						>
							{icon}
						</div>
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

function formatTimeAgo(date) {
	const now = Date.now();
	const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
	const diff = now - then;

	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}
