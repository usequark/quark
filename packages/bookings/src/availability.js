import { createLogger } from "@techstream/quark-core";
import { ValidationError } from "@techstream/quark-core/errors";
import { resolveSlotScopeKey } from "./config.js";

const logger = createLogger({ name: "bookings:availability" });

function supportsSlotScope(prisma) {
	return Boolean(prisma?.availabilitySlot?.fields?.slotScopeKey);
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} [params.serviceId]
 * @param {string} [params.staffId]
 * @param {Date} params.dateFrom
 * @param {Date} params.dateTo
 * @returns {Promise<Array>}
 */
export async function getAvailableSlots({
	prisma,
	serviceId,
	staffId,
	dateFrom,
	dateTo,
}) {
	const slotScopeKey = serviceId ? resolveSlotScopeKey(serviceId) : undefined;
	const useSlotScope = supportsSlotScope(prisma);

	const where = {
		active: true,
		startTime: { gte: dateFrom },
		endTime: { lte: dateTo },
		...(slotScopeKey
			? useSlotScope
				? { slotScopeKey }
				: { serviceId: serviceId || undefined }
			: {}),
		...(staffId && { staffId }),
	};

	const slots = await prisma.availabilitySlot.findMany({
		where,
		include: {
			service: true,
			staff: true,
		},
		orderBy: { startTime: "asc" },
	});

	return slots.filter((slot) => slot.bookedCount < slot.capacity);
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.slotId
 * @returns {Promise<boolean>}
 */
export async function checkSlotAvailability({ prisma, slotId }) {
	const result = await prisma.availabilitySlot.updateMany({
		where: {
			id: slotId,
			active: true,
			bookedCount: { lt: prisma.availabilitySlot.fields.capacity },
		},
		data: {
			bookedCount: { increment: 1 },
		},
	});

	return result.count > 0;
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.slotId
 */
export async function releaseSlot({ prisma, slotId }) {
	const result = await prisma.availabilitySlot.updateMany({
		where: {
			id: slotId,
			bookedCount: { gt: 0 },
		},
		data: {
			bookedCount: { decrement: 1 },
		},
	});

	if (result.count === 0) {
		logger.warn("releaseSlot: slot not found or bookedCount already 0", {
			slotId,
		});
	}
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.serviceId
 * @param {string} [params.staffId]
 * @param {Date} params.dateFrom
 * @param {Date} params.dateTo
 * @param {Array<{dayOfWeek: number, times: string[]}>} [params.pattern]
 * @returns {Promise<{created: number, skipped: number}>}
 */
export async function generateSlots({
	prisma,
	serviceId,
	staffId,
	dateFrom,
	dateTo,
	pattern,
}) {
	const service = await prisma.serviceType.findUnique({
		where: { id: serviceId },
	});
	if (!service) {
		throw new ValidationError("Service not found", { serviceId });
	}

	const durationMinutes = service.duration || 30;
	const slotScopeKey = resolveSlotScopeKey(serviceId);
	const useSlotScope = supportsSlotScope(prisma);
	let created = 0;
	let skipped = 0;

	const current = new Date(dateFrom);
	const end = new Date(dateTo);

	while (current < end) {
		const dayOfWeek = current.getDay();

		if (pattern && pattern.length > 0) {
			const dayPattern = pattern.find((p) => p.dayOfWeek === dayOfWeek);
			if (!dayPattern) {
				current.setDate(current.getDate() + 1);
				current.setHours(0, 0, 0, 0);
				continue;
			}

			for (const time of dayPattern.times) {
				const [hours, minutes] = time.split(":").map(Number);
				const start = new Date(current);
				start.setHours(hours, minutes, 0, 0);
				const endTime = new Date(start.getTime() + durationMinutes * 60 * 1000);

				const existing = await prisma.availabilitySlot.findFirst({
					where: {
						...(useSlotScope ? { slotScopeKey } : { serviceId }),
						startTime: start,
						endTime: endTime,
						...(staffId && { staffId }),
					},
				});

				if (existing) {
					skipped++;
					continue;
				}

				await prisma.availabilitySlot.create({
					data: {
						serviceId,
						...(useSlotScope ? { slotScopeKey } : {}),
						staffId: staffId || null,
						startTime: start,
						endTime: endTime,
						capacity: service.capacity,
					},
				});
				created++;
			}
		}

		current.setDate(current.getDate() + 1);
		current.setHours(0, 0, 0, 0);
	}

	return { created, skipped };
}
