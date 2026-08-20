import {
	formatCurrency,
	getCrmConfig,
	getPipelineSummary,
} from "@techstream/quark-crm";
import { prisma } from "@techstream/quark-db";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@techstream/quark-ui";
import Link from "next/link";

export async function generateMetadata() {
	const config = await getCrmConfig();
	return { title: config.entityPluralLabel };
}

export default async function DealsPage({ searchParams }) {
	const { stage: activeStage } = await searchParams;
	const config = await getCrmConfig();
	const pipeline = await getPipelineSummary(prisma, config).catch(() => null);
	const currencyOpts = { locale: config.locale, currency: config.currency };

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
								d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
							/>
						</svg>
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-text">
							{config.entityPluralLabel}
						</h1>
						<p className="mt-0.5 text-sm text-text-faint">
							Pipeline and {config.entityLabel.toLowerCase()} management
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
				<Link
					href="/admin/crm"
					className="border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
				>
					CRM
				</Link>
				<Link
					href="/admin/crm/deals"
					className="border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text"
				>
					{config.entityPluralLabel}
				</Link>
				<Link
					href="/admin/crm/deals/pipeline"
					className="border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-text"
				>
					Pipeline Board
				</Link>
				<div className="ml-auto">
					<Link href="/admin/crm/deals/new">
						<Button size="sm">New {config.entityLabel}</Button>
					</Link>
				</div>
			</div>

			{pipeline && (
				<div className="space-y-6">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
						{pipeline.stages.map((group) => {
							const stageConfig = config.pipelineStages.find(
								(s) => s.key === group.stage,
							);
							const isActive = activeStage === group.stage;

							return (
								<Link
									key={group.stage}
									href={`/admin/crm/deals?stage=${group.stage}`}
									className={`block group h-full ${isActive ? "ring-2 ring-primary" : ""}`}
								>
									<Card className="transition-all duration-200 hover:border-primary/40 h-full flex flex-col">
										<CardHeader className="pb-2">
											<CardTitle className="text-xs font-semibold text-text-muted uppercase tracking-widest">
												{stageConfig?.label ?? group.stage}
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-xl font-bold tabular-nums text-text">
												{group.count}
											</p>
											<p className="text-xs text-text-faint tabular-nums mt-1">
												{formatCurrency(group.totalValue, currencyOpts)}
											</p>
											<p className="text-xs text-text-faint tabular-nums">
												est. {formatCurrency(group.expectedValue, currencyOpts)}
											</p>
										</CardContent>
									</Card>
								</Link>
							);
						})}
					</div>

					<div className="border border-border bg-surface divide-y divide-border">
						{pipeline.stages
							.filter((g) => !activeStage || g.stage === activeStage)
							.flatMap((group) =>
								group.deals.map((deal) => {
									const stageConfig = config.pipelineStages.find(
										(s) => s.key === deal.stage,
									);
									return (
										<Link
											key={deal.id}
											href={`/admin/deal/${deal.id}`}
											className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
										>
											<div className="min-w-0 flex-1">
												<p className="text-sm font-medium text-text truncate">
													{deal.title}
												</p>
												<p className="text-xs text-text-faint mt-0.5">
													{deal.contact
														? `${deal.contact.firstName} ${deal.contact.lastName}`
														: `No ${config.actorLabel.toLowerCase()}`}
													{deal.company && ` · ${deal.company.name}`}
												</p>
											</div>
											<div className="flex items-center gap-3 ml-4">
												<div
													className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${stageConfig?.color}-muted text-${stageConfig?.color}`}
												>
													{stageConfig?.label ?? deal.stage}
												</div>
												<p className="text-sm font-semibold tabular-nums text-text">
													{formatCurrency(Number(deal.value), currencyOpts)}
												</p>
												<p className="text-xs text-text-faint w-8 text-right">
													{deal.probability}%
												</p>
											</div>
										</Link>
									);
								}),
							)}
					</div>
				</div>
			)}

			{pipeline === null && (
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-sm text-text-faint">
							Unable to load pipeline data. Make sure the database is running
							and migrations have been applied.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
