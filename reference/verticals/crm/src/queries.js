import { DEFAULT_CRM_CONFIG } from "./config.js";

/**
 * @param {object} prisma
 * @param {typeof DEFAULT_CRM_CONFIG} [config]
 */
export async function getPipelineSummary(prisma, config = DEFAULT_CRM_CONFIG) {
	const stages = config.pipelineStages ?? DEFAULT_CRM_CONFIG.pipelineStages;

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

/**
 * @param {object} prisma
 * @param {string} companyId
 * @param {typeof DEFAULT_CRM_CONFIG} [config]
 */
export async function getCompanyMetrics(
	prisma,
	companyId,
	config = DEFAULT_CRM_CONFIG,
) {
	const stages = config.pipelineStages ?? DEFAULT_CRM_CONFIG.pipelineStages;
	const terminalKeys = stages
		.filter((s) => !s.next || s.next.length === 0)
		.map((s) => s.key);
	const closedKeys =
		terminalKeys.length > 0 ? terminalKeys : ["CLOSED_WON", "CLOSED_LOST"];
	const wonKey =
		stages.find((s) => s.probability === 100)?.key ??
		closedKeys.find((k) => k.includes("WON")) ??
		"CLOSED_WON";

	const [contactCount, activeDeals, wonDeals] = await Promise.all([
		prisma.contact.count({ where: { companyId } }),
		prisma.deal.count({
			where: {
				companyId,
				stage: { notIn: closedKeys },
			},
		}),
		prisma.deal.count({ where: { companyId, stage: wonKey } }),
	]);

	return { contactCount, activeDeals, wonDeals };
}
