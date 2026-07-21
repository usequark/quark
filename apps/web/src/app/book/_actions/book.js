"use server";

import {
	resolveSlotScopeKey,
	SLOT_SCOPE_PER_SERVICE,
} from "@techstream/quark-bookings";
import { createLogger } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { redirect } from "next/navigation";
import { z } from "zod";

const logger = createLogger("book:actions");

const formSchema = z.object({
	serviceTypeId: z.string().min(1, "Please select a lane type"),
	date: z.string().min(1, "Please select a date"),
	startTime: z.string().min(1, "Please select a start time"),
	duration: z.string().min(1, "Please select a duration"),
	name: z.string().min(1, "Name is required").max(200),
	email: z.string().email("Valid email is required"),
	phone: z.string().optional(),
	notes: z.string().max(2000).optional(),
});

function parseTime(timeStr) {
	const [h, m] = timeStr.split(":").map(Number);
	return { hours: h, minutes: m };
}

function getConsecutiveSlotTimes(startTime, durationMinutes) {
	const { hours, minutes } = parseTime(startTime);
	const blocks = durationMinutes / 30;
	const times = [];

	for (let i = 0; i < blocks; i++) {
		const blockMin = minutes + i * 30;
		const h = hours + Math.floor(blockMin / 60);
		const m = blockMin % 60;
		times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
	}

	return times;
}

function supportsSlotScope(model) {
	return Boolean(model?.fields?.slotScopeKey);
}

async function releaseReservedSlots(tx, slotIds) {
	for (const slotId of slotIds) {
		await tx.availabilitySlot.updateMany({
			where: {
				id: slotId,
				bookedCount: { gt: 0 },
			},
			data: {
				bookedCount: { decrement: 1 },
			},
		});
	}
}

export async function bookLane(_prevState, formData) {
	const raw = Object.fromEntries(formData.entries());
	const parsed = formSchema.safeParse(raw);

	if (!parsed.success) {
		return { errors: parsed.error.flatten().fieldErrors };
	}

	const {
		serviceTypeId,
		date,
		startTime,
		duration,
		name,
		email,
		phone,
		notes,
	} = parsed.data;
	const normalizedEmail = email.trim().toLowerCase();
	const durationMinutes = Number.parseInt(duration, 10);
	const slotTimes = getConsecutiveSlotTimes(startTime, durationMinutes);
	const slotScopeKey = resolveSlotScopeKey(serviceTypeId, {
		scope: SLOT_SCOPE_PER_SERVICE,
	});
	const bookingLockKey = `${slotScopeKey}:${date}:${startTime}:${durationMinutes}:${normalizedEmail}`;
	const isPostgres = (process.env.DATABASE_URL || "").startsWith("postgres");
	const useSlotScope = supportsSlotScope(prisma.availabilitySlot);

	try {
		await prisma.$transaction(async (tx) => {
			if (isPostgres) {
				await tx.$executeRaw`
					SELECT pg_advisory_xact_lock(hashtext(${bookingLockKey}))
				`;
			}

			const bookedSlotIds = [];

			for (let i = 0; i < slotTimes.length; i++) {
				const [blockH, blockM] = slotTimes[i].split(":").map(Number);

				const slotStart = new Date(
					`${date}T${String(blockH).padStart(2, "0")}:${String(blockM).padStart(2, "0")}:00`,
				);
				const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

				let slot = await tx.availabilitySlot.findFirst({
					where: {
						...(useSlotScope ? { slotScopeKey } : { serviceId: serviceTypeId }),
						startTime: slotStart,
						endTime: slotEnd,
						active: true,
					},
				});

				if (!slot) {
					try {
						slot = await tx.availabilitySlot.create({
							data: {
								serviceId: serviceTypeId,
								...(useSlotScope ? { slotScopeKey } : {}),
								startTime: slotStart,
								endTime: slotEnd,
								capacity: 1,
								bookedCount: 0,
							},
						});
					} catch (createErr) {
						if (createErr.code === "P2002") {
							slot = await tx.availabilitySlot.findFirst({
								where: {
									...(useSlotScope
										? { slotScopeKey }
										: { serviceId: serviceTypeId }),
									startTime: slotStart,
									endTime: slotEnd,
									active: true,
								},
							});
							if (!slot) {
								throw new AppError(
									"Time slot is no longer available",
									409,
									"SLOT_FULL",
								);
							}
						} else {
							throw createErr;
						}
					}
				}

				if (i === 0) {
					const existing = await tx.booking.findFirst({
						where: {
							slotId: slot.id,
							email: {
								equals: normalizedEmail,
								mode: "insensitive",
							},
						},
					});

					if (existing) {
						logger.warn("Duplicate booking prevented", {
							slotId: slot.id,
							email: normalizedEmail,
							existingId: existing.id,
						});
						return;
					}
				}

				const result = await tx.availabilitySlot.updateMany({
					where: {
						id: slot.id,
						active: true,
						bookedCount: { lt: tx.availabilitySlot.fields.capacity },
					},
					data: {
						bookedCount: { increment: 1 },
					},
				});

				if (result.count === 0) {
					throw new AppError("Time slot is fully booked", 409, "SLOT_FULL");
				}

				bookedSlotIds.push(slot.id);
			}

			const firstSlotId = bookedSlotIds[0];

			const cancelToken = crypto.randomUUID();

			try {
				await tx.booking.create({
					data: {
						name,
						email: normalizedEmail,
						phone: phone || null,
						notes: notes || null,
						slotId: firstSlotId,
						serviceTypeId,
						durationMinutes,
						status: "CONFIRMED",
						cancelToken,
					},
				});
			} catch (createErr) {
				if (createErr.code === "P2002") {
					await releaseReservedSlots(tx, bookedSlotIds);
					const existing = await tx.booking.findFirst({
						where: {
							slotId: firstSlotId,
							email: {
								equals: normalizedEmail,
								mode: "insensitive",
							},
						},
					});

					logger.warn("Duplicate booking blocked by unique constraint", {
						slotId: firstSlotId,
						email: normalizedEmail,
						existingId: existing?.id,
					});
					return;
				}
				throw createErr;
			}

			logger.info("Booking created", {
				email: normalizedEmail,
				durationMinutes,
				blocks: bookedSlotIds.length,
			});
		});
	} catch (err) {
		if (err.code === "SLOT_FULL") {
			return {
				errors: {
					startTime: [
						"This time slot is no longer available. Please choose another time.",
					],
				},
			};
		}
		throw err;
	}

	redirect("/book?booked=true");
}

export async function getBookedSlots(serviceId, date) {
	if (!serviceId || !date) return [];

	const slotScopeKey = resolveSlotScopeKey(serviceId, {
		scope: SLOT_SCOPE_PER_SERVICE,
	});
	const useSlotScope = supportsSlotScope(prisma.availabilitySlot);

	const dayStart = new Date(`${date}T00:00:00.000`);
	const dayEnd = new Date(`${date}T23:59:59.999`);

	const slots = await prisma.availabilitySlot.findMany({
		where: {
			...(useSlotScope ? { slotScopeKey } : { serviceId }),
			startTime: { gte: dayStart, lte: dayEnd },
			active: true,
			bookedCount: { gte: 1 },
		},
		select: { startTime: true },
		orderBy: { startTime: "asc" },
	});

	return slots.map((s) => {
		const h = String(s.startTime.getHours()).padStart(2, "0");
		const m = String(s.startTime.getMinutes()).padStart(2, "0");
		return `${h}:${m}`;
	});
}
