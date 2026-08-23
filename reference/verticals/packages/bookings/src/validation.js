import { z } from "zod";

export const bookingSchema = z.object({
	name: z.string().min(1, "Name is required").max(200),
	email: z.string().email("Invalid email address"),
	phone: z.string().max(20).optional(),
	notes: z.string().max(2000).optional(),
	slotId: z.string().min(1, "Time slot is required"),
	serviceTypeId: z.string().min(1, "Service is required"),
	staffId: z.string().optional(),
	durationMinutes: z.number().int().positive().default(30),
	customFields: z.record(z.unknown()).optional(),
});

export const serviceTypeSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	duration: z.number().int().positive("Duration must be a positive number"),
	price: z.number().min(0).optional(),
	capacity: z.number().int().positive().default(1),
	active: z.boolean().default(true),
});

export const slotSchema = z.object({
	serviceId: z.string().min(1),
	staffId: z.string().optional(),
	startTime: z.coerce.date(),
	endTime: z.coerce.date(),
	capacity: z.number().int().positive().default(1),
});

export const slotBulkSchema = z.object({
	serviceId: z.string().min(1),
	staffId: z.string().optional(),
	dateFrom: z.coerce.date(),
	dateTo: z.coerce.date(),
	pattern: z
		.array(
			z.object({
				dayOfWeek: z.number().int().min(0).max(6),
				times: z.array(z.string()),
			}),
		)
		.optional(),
});

export const cancelBookingSchema = z.object({
	cancelledReason: z.string().max(2000).optional(),
});
