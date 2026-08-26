"use client";

import { moveDealStage } from "../_actions/deals";
import DealCard from "./DealCard";
import StageColumn from "./StageColumn";

export default function PipelineBoard({ config, stages }) {
	const stageDefs = config.pipelineStages;
	const currencyOpts = { locale: config.locale, currency: config.currency };

	const stageMap = {};
	for (const group of stages) {
		stageMap[group.stage] = group;
	}

	async function handleMove(dealId, newStage) {
		await moveDealStage(dealId, newStage);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
			{stageDefs.map((stageDef) => {
				const group = stageMap[stageDef.key] ?? {
					deals: [],
					count: 0,
					totalValue: 0,
					expectedValue: 0,
				};

				return (
					<StageColumn
						key={stageDef.key}
						stage={stageDef}
						count={group.count}
						totalValue={group.totalValue}
						entityPluralLabel={config.entityPluralLabel}
						currencyOpts={currencyOpts}
					>
						{group.deals.map((deal) => {
							const availableTransitions =
								stageDefs
									.find((s) => s.key === deal.stage)
									?.next?.map((targetKey) => {
										const target = stageDefs.find((s) => s.key === targetKey);
										return {
											key: targetKey,
											label: target?.label ?? targetKey,
										};
									}) ?? [];

							return (
								<DealCard
									key={deal.id}
									deal={deal}
									transitions={availableTransitions}
									onMove={handleMove}
									currencyOpts={currencyOpts}
								/>
							);
						})}
					</StageColumn>
				);
			})}
		</div>
	);
}
