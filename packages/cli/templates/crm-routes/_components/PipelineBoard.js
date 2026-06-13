"use client";

import { crmConfig } from "@techstream/quark-crm";
import { moveDealStage } from "../_actions/deals";
import DealCard from "./DealCard";
import StageColumn from "./StageColumn";

export default function PipelineBoard({ stages }) {
	const stageDefs = crmConfig.pipelineStages;

	const stageMap = {};
	for (const group of stages) {
		stageMap[group.stage] = group;
	}

	const stageIndex = {};
	for (let i = 0; i < stageDefs.length; i++) {
		stageIndex[stageDefs[i].key] = i;
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
								/>
							);
						})}
					</StageColumn>
				);
			})}
		</div>
	);
}
