import { crmConfig } from "./config.js";

export async function getPipelineSummary(prisma) {
	const stages = crmConfig.pipelineStages;

	const groupings = await Promise.all(
		stages.map(async (stageDef) => {
			const deals = await prisma.deal.findMany({
				where: { stage: stageDef.key },
				include: {
					contact: {
						select: { id: true, firstName: true, lastName: true },
					},
					company: { select: { id: true, name: true } },
				},
				orderBy: { updatedAt: "desc" },
			});

			const totalValue = deals.reduce((sum, d) => sum + Number(d.value), 0);
			const expectedValue = deals.reduce(
				(sum, d) => sum + Number(d.value) * (d.probability / 100),
				0,
			);

			return {
				stage: stageDef.key,
				deals,
				count: deals.length,
				totalValue,
				expectedValue,
			};
		}),
	);

	const activeStageKeys = stages
		.filter((s) => s.next.length > 0 && s.key !== "CLOSED_LOST")
		.map((s) => s.key);

	const totalPipelineValue = groupings
		.filter((g) => activeStageKeys.includes(g.stage))
		.reduce((sum, g) => sum + g.totalValue, 0);

	const totalExpectedValue = groupings
		.filter((g) => activeStageKeys.includes(g.stage))
		.reduce((sum, g) => sum + g.expectedValue, 0);

	return {
		stages: groupings,
		totalPipelineValue,
		totalExpectedValue,
	};
}

export async function getCompanyMetrics(prisma, companyId) {
	const [contactCount, activeDeals, wonDeals] = await Promise.all([
		prisma.contact.count({ where: { companyId } }),
		prisma.deal.count({
			where: {
				companyId,
				stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
			},
		}),
		prisma.deal.count({ where: { companyId, stage: "CLOSED_WON" } }),
	]);

	return { contactCount, activeDeals, wonDeals };
}
