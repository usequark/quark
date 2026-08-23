import { createLogger } from "@techstream/quark-core";
import { AppError, ValidationError } from "@techstream/quark-core/errors";
import { checkSlotAvailability, releaseSlot } from "./availability.js";
import { applyTransition, canTransition } from "./status.js";
import { bookingSchema, cancelBookingSchema } from "./validation.js";

const logger = createLogger({ name: "bookings:queries" });

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {object} params.data
 * @returns {Promise<object>}
 */
export async function createBooking({ prisma, data }) {
	const parsed = bookingSchema.safeParse(data);
	if (!parsed.success) {
		throw new ValidationError("Invalid booking data", parsed.error.flatten());
	}

	const {
		name,
		email,
		phone,
		notes,
		slotId,
		serviceTypeId,
		staffId,
		durationMinutes,
		customFields,
	} = parsed.data;

	const existing = await prisma.booking.findFirst({
		where: { slotId, email },
	});

	if (existing) {
		logger.warn("Duplicate booking prevented", {
			slotId,
			email,
			existingId: existing.id,
		});
		return existing;
	}

	const slot = await prisma.availabilitySlot.findUnique({
		where: { id: slotId },
		include: { service: true },
	});

	if (!slot || !slot.active) {
		throw new AppError(
			"Selected time slot is not available",
			400,
			"SLOT_UNAVAILABLE",
		);
	}

	const isAvailable = await checkSlotAvailability({ prisma, slotId });

	if (!isAvailable) {
		throw new AppError("Time slot is fully booked", 409, "SLOT_FULL");
	}

	const cancelToken = crypto.randomUUID();

	let booking;
	try {
		booking = await prisma.booking.create({
			data: {
				name,
				email,
				phone: phone || null,
				notes: notes || null,
				slotId,
				serviceTypeId,
				staffId: staffId || null,
				durationMinutes: durationMinutes || 30,
				customFields: customFields || undefined,
				status: "CONFIRMED",
				cancelToken,
			},
			include: {
				slot: {
					include: { service: true },
				},
				serviceType: true,
				staff: true,
			},
		});
	} catch (createErr) {
		if (createErr.code === "P2002") {
			const dup = await prisma.booking.findFirst({
				where: { slotId, email },
				include: {
					slot: { include: { service: true } },
					serviceType: true,
					staff: true,
				},
			});
			if (dup) {
				await releaseSlot({ prisma, slotId });
				logger.warn("Duplicate booking caught via unique constraint", {
					slotId,
					email,
					existingId: dup.id,
				});
				return dup;
			}
			throw createErr;
		}
		throw createErr;
	}

	logger.info("Booking created", { bookingId: booking.id, email });

	return booking;
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.bookingId
 * @param {object} params.data
 * @returns {Promise<object>}
 */
export async function cancelBooking({ prisma, bookingId, data }) {
	const parsed = cancelBookingSchema.safeParse(data ?? {});
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid cancellation data",
			parsed.error.flatten(),
		);
	}

	const { cancelledReason } = parsed.data;

	const booking = await prisma.booking.findUnique({
		where: { id: bookingId },
		include: { slot: true },
	});

	if (!booking) {
		throw new AppError("Booking not found", 404, "BOOKING_NOT_FOUND");
	}

	if (!canTransition(booking.status, "CANCELLED")) {
		throw new AppError(
			`Cannot cancel booking with status ${booking.status}`,
			400,
			"INVALID_TRANSITION",
		);
	}

	const patch = applyTransition(booking, "CANCELLED");

	const updated = await prisma.booking.update({
		where: { id: bookingId },
		data: {
			...patch,
			cancelledReason: cancelledReason || null,
		},
	});

	const slotStart = booking.slot.startTime;
	const durationMs = booking.durationMinutes * 60 * 1000;
	const slotEnd = new Date(slotStart.getTime() + durationMs);
	const useSlotScope = Boolean(prisma?.availabilitySlot?.fields?.slotScopeKey);

	const blockedSlots = await prisma.availabilitySlot.findMany({
		where: {
			...(useSlotScope
				? { slotScopeKey: booking.slot.slotScopeKey }
				: { serviceId: booking.serviceTypeId }),
			startTime: { gte: slotStart },
			endTime: { lte: slotEnd },
			active: true,
			bookedCount: { gt: 0 },
		},
	});

	for (const slot of blockedSlots) {
		await releaseSlot({ prisma, slotId: slot.id });
	}

	logger.info("Booking cancelled", {
		bookingId,
		reason: cancelledReason,
		releasedSlots: blockedSlots.length,
	});

	return updated;
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.bookingId
 * @returns {Promise<object>}
 */
export async function confirmBooking({ prisma, bookingId }) {
	const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

	if (!booking) {
		throw new AppError("Booking not found", 404, "BOOKING_NOT_FOUND");
	}

	if (!canTransition(booking.status, "CONFIRMED")) {
		throw new AppError(
			`Cannot confirm booking with status ${booking.status}`,
			400,
			"INVALID_TRANSITION",
		);
	}

	const patch = applyTransition(booking, "CONFIRMED");

	return prisma.booking.update({
		where: { id: bookingId },
		data: patch,
	});
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.bookingId
 * @returns {Promise<object>}
 */
export async function completeBooking({ prisma, bookingId }) {
	const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

	if (!booking) {
		throw new AppError("Booking not found", 404, "BOOKING_NOT_FOUND");
	}

	if (!canTransition(booking.status, "COMPLETED")) {
		throw new AppError(
			`Cannot complete booking with status ${booking.status}`,
			400,
			"INVALID_TRANSITION",
		);
	}

	return prisma.booking.update({
		where: { id: bookingId },
		data: { status: "COMPLETED" },
	});
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.id
 * @returns {Promise<object|null>}
 */
export async function findBookingById({ prisma, id }) {
	return prisma.booking.findUnique({
		where: { id },
		include: {
			slot: {
				include: { service: true },
			},
			serviceType: true,
			staff: true,
		},
	});
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {object} params.filters
 * @returns {Promise<{bookings: Array, total: number}>}
 */
export async function findBookings({ prisma, filters = {} }) {
	const {
		status,
		serviceId,
		staffId,
		dateFrom,
		dateTo,
		search,
		page = 1,
		pageSize = 25,
	} = filters;

	const where = {};

	if (status) where.status = status;
	if (serviceId) where.serviceTypeId = serviceId;
	if (staffId) where.staffId = staffId;
	if (dateFrom || dateTo) {
		where.slot = {};
		if (dateFrom) where.slot.startTime = { gte: dateFrom };
		if (dateTo) {
			where.slot = {
				...where.slot,
				endTime: { lte: dateTo },
			};
		}
	}
	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ email: { contains: search, mode: "insensitive" } },
		];
	}

	const [bookings, total] = await Promise.all([
		prisma.booking.findMany({
			where,
			include: {
				slot: {
					include: { service: true },
				},
				serviceType: true,
				staff: true,
			},
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.booking.count({ where }),
	]);

	return { bookings, total };
}

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {string} params.token
 * @returns {Promise<object|null>}
 */
export async function findBookingByCancelToken({ prisma, token }) {
	return prisma.booking.findUnique({
		where: { cancelToken: token },
		include: {
			slot: {
				include: { service: true },
			},
			serviceType: true,
			staff: true,
		},
	});
}
