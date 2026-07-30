import { crmConfig, getPipelineSummary } from "@techstream/quark-crm";
import { prisma } from "@techstream/quark-db";
import { Button } from "@techstream/quark-ui";
import Link from "next/link";
import PipelineBoard from "../../_components/PipelineBoard";

export const metadata = { title: "Pipeline Board" };

export default async function PipelineBoardPage() {
	const pipeline = await getPipelineSummary(prisma).catch(() => null);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-bold tracking-tight text-text">
						Pipeline Board
					</h1>
					<p className="mt-0.5 text-sm text-text-faint">
						Move {crmConfig.entityPluralLabel.toLowerCase()} between stages to
						update their status
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Link
						href="/admin/crm/deals"
						className="text-sm text-primary hover:opacity-75"
					>
						List View
					</Link>
					<Link href="/admin/crm/deals/new">
						<Button size="sm">New {crmConfig.entityLabel}</Button>
					</Link>
				</div>
			</div>

			{pipeline ? (
				<PipelineBoard stages={pipeline.stages} />
			) : (
				<div className="border border-border bg-surface p-8 text-center">
					<p className="text-sm text-text-faint">
						Unable to load pipeline data. Make sure the database is running and
						migrations have been applied.
					</p>
				</div>
			)}
		</div>
	);
}
