import { crmConfig, getPipelineSummary } from "@techstream/quark-crm";
import { prisma } from "@techstream/quark-db";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@techstream/quark-ui";
import Link from "next/link";

export const metadata = { title: "CRM" };

export default async function CrmDashboard() {
	const pipeline = await getPipelineSummary(prisma).catch(() => null);

	const contactCount = await prisma.contact.count();

	return (
		<div className="space-y-10">
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
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							/>
						</svg>
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-text">CRM</h1>
						<p className="mt-0.5 text-sm text-text-faint">
							Manage contacts, companies, and deals
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
				<Link
					href="/admin/crm"
					className="border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text"
				>
					Overview
				</Link>
				<Link
					href="/admin/crm/deals"
					className="border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
				>
					Deals
				</Link>
				<Link
					href="/admin/contact"
					className="border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
				>
					Contacts
				</Link>
				<Link
					href="/admin/company"
					className="border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
				>
					Companies
				</Link>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Total Deals"
					value={pipeline?.stages.reduce((s, g) => s + g.count, 0) ?? 0}
					sub="across all stages"
				/>
				<StatCard
					label="Pipeline Value"
					value={
						pipeline
							? new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: "USD",
									maximumFractionDigits: 0,
								}).format(pipeline.totalPipelineValue)
							: "$0"
					}
					sub="active deals"
				/>
				<StatCard
					label="Expected Value"
					value={
						pipeline
							? new Intl.NumberFormat("en-US", {
									style: "currency",
									currency: "USD",
									maximumFractionDigits: 0,
								}).format(pipeline.totalExpectedValue)
							: "$0"
					}
					sub="probability-weighted"
				/>
				<StatCard label="Contacts" value={contactCount} sub="people" />
			</div>

			{pipeline && (
				<section>
					<div className="mb-4 flex items-center gap-3">
						<div className="h-px flex-1 bg-border" />
						<h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">
							Pipeline Overview
						</h2>
						<div className="h-px flex-1 bg-border" />
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
						{pipeline.stages.map((group) => {
							const stageConfig = crmConfig.pipelineStages.find(
								(s) => s.key === group.stage,
							);
							return (
								<Link
									key={group.stage}
									href={`/admin/crm/deals?stage=${group.stage}`}
									className="block group h-full"
								>
									<Card className="transition-all duration-200 hover:border-primary/40 h-full flex flex-col">
										<div
											className={`h-0.5 bg-${stageConfig?.color ?? "default"}`}
										/>
										<CardHeader className="pb-2">
											<CardTitle className="text-xs font-semibold text-text-muted uppercase tracking-widest">
												{stageConfig?.label ?? group.stage}
											</CardTitle>
										</CardHeader>
										<CardContent className="flex flex-col flex-1">
											<p className="text-2xl font-bold tabular-nums text-text">
												{group.count}
											</p>
											<p className="mt-auto text-xs text-text-faint tabular-nums">
												{new Intl.NumberFormat("en-US", {
													style: "currency",
													currency: "USD",
													maximumFractionDigits: 0,
												}).format(group.totalValue)}
											</p>
										</CardContent>
									</Card>
								</Link>
							);
						})}
					</div>
				</section>
			)}

			<div className="flex gap-4">
				<Link href="/admin/crm/deals/new">
					<Button size="sm">New Deal</Button>
				</Link>
				<Link href="/admin/contact/new">
					<Button size="sm" variant="secondary">
						New Contact
					</Button>
				</Link>
				<Link href="/admin/company/new">
					<Button size="sm" variant="secondary">
						New Company
					</Button>
				</Link>
			</div>
		</div>
	);
}

function StatCard({ label, value, sub }) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-xs font-semibold text-text-faint uppercase tracking-widest">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-2xl font-bold tabular-nums text-text">{value}</p>
				{sub && <p className="text-xs text-text-faint mt-1">{sub}</p>}
			</CardContent>
		</Card>
	);
}
