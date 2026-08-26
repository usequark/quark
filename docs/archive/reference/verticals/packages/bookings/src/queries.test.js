import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	cancelBooking,
	createBooking,
	findBookingByCancelToken,
	findBookings,
} from "./queries.js";

const validBookingData = {
	name: "Jane Doe",
	email: "jane@example.com",
	slotId: "slot-1",
	serviceTypeId: "svc-1",
};

function mockPrisma(overrides = {}) {
	return {
		booking: {
			findFirst: mock.fn(async () => null),
			findUnique: mock.fn(async () => null),
			findMany: mock.fn(async () => []),
			count: mock.fn(async () => 0),
			create: mock.fn(async (args) => ({
				id: "booking-1",
				...args.data,
			})),
			update: mock.fn(async (args) => ({
				id: args.where.id,
				...args.data,
			})),
			...overrides.booking,
		},
		availabilitySlot: {
			findUnique: mock.fn(async () => ({
				id: "slot-1",
				active: true,
				startTime: new Date("2026-07-28T10:00:00.000Z"),
				endTime: new Date("2026-07-28T10:30:00.000Z"),
				service: { id: "svc-1", name: "Consult" },
				slotScopeKey: "svc-1",
			})),
			updateMany: mock.fn(async () => ({ count: 1 })),
			findMany: mock.fn(async () => []),
			fields: {},
			...overrides.availabilitySlot,
		},
		...overrides,
	};
}

describe("createBooking", () => {
	it("creates a booking on success", async () => {
		const created = {
			id: "booking-1",
			name: "Jane Doe",
			email: "jane@example.com",
			status: "CONFIRMED",
			cancelToken: "token-1",
		};

		const prisma = mockPrisma({
			booking: {
				findFirst: mock.fn(async () => null),
				create: mock.fn(async () => created),
			},
			availabilitySlot: {
				findUnique: mock.fn(async () => ({
					id: "slot-1",
					active: true,
					service: { id: "svc-1" },
				})),
				updateMany: mock.fn(async () => ({ count: 1 })),
				fields: { capacity: true },
			},
		});

		const result = await createBooking({ prisma, data: validBookingData });

		assert.equal(result.id, "booking-1");
		assert.equal(result.status, "CONFIRMED");
		assert.equal(prisma.booking.create.mock.callCount(), 1);

		const createArgs = prisma.booking.create.mock.calls[0].arguments[0];
		assert.equal(createArgs.data.name, "Jane Doe");
		assert.equal(createArgs.data.email, "jane@example.com");
		assert.equal(createArgs.data.slotId, "slot-1");
		assert.equal(createArgs.data.serviceTypeId, "svc-1");
		assert.equal(createArgs.data.status, "CONFIRMED");
		assert.equal(typeof createArgs.data.cancelToken, "string");
	});

	it("returns existing booking on duplicate", async () => {
		const existing = {
			id: "existing-1",
			email: "jane@example.com",
			slotId: "slot-1",
		};

		const prisma = mockPrisma({
			booking: {
				findFirst: mock.fn(async () => existing),
				create: mock.fn(async () => {
					throw new Error("should not create");
				}),
			},
		});

		const result = await createBooking({ prisma, data: validBookingData });

		assert.equal(result.id, "existing-1");
		assert.equal(prisma.booking.create.mock.callCount(), 0);
	});

	it("returns existing booking when unique constraint fires", async () => {
		const dup = {
			id: "dup-1",
			email: "jane@example.com",
			slotId: "slot-1",
		};

		let findFirstCalls = 0;
		const prisma = mockPrisma({
			booking: {
				findFirst: mock.fn(async () => {
					findFirstCalls += 1;
					// first call: no existing; second call (after P2002): return dup
					return findFirstCalls === 1 ? null : dup;
				}),
				create: mock.fn(async () => {
					const err = new Error("Unique constraint");
					err.code = "P2002";
					throw err;
				}),
			},
			availabilitySlot: {
				findUnique: mock.fn(async () => ({
					id: "slot-1",
					active: true,
					service: { id: "svc-1" },
				})),
				updateMany: mock.fn(async () => ({ count: 1 })),
				fields: { capacity: true },
			},
		});

		const result = await createBooking({ prisma, data: validBookingData });

		assert.equal(result.id, "dup-1");
		assert.equal(findFirstCalls, 2);
		// checkSlotAvailability + releaseSlot both call updateMany
		assert.equal(prisma.availabilitySlot.updateMany.mock.callCount(), 2);
	});

	it("throws ValidationError for invalid data", async () => {
		const prisma = mockPrisma();

		await assert.rejects(
			() => createBooking({ prisma, data: { name: "Only name" } }),
			(err) => {
				assert.equal(err.message, "Invalid booking data");
				return true;
			},
		);
	});

	it("throws when slot is unavailable", async () => {
		const prisma = mockPrisma({
			booking: {
				findFirst: mock.fn(async () => null),
			},
			availabilitySlot: {
				findUnique: mock.fn(async () => null),
				updateMany: mock.fn(async () => ({ count: 0 })),
				fields: {},
			},
		});

		await assert.rejects(
			() => createBooking({ prisma, data: validBookingData }),
			(err) => {
				assert.equal(err.message, "Selected time slot is not available");
				assert.equal(err.code, "SLOT_UNAVAILABLE");
				return true;
			},
		);
	});

	it("throws when slot is full", async () => {
		const prisma = mockPrisma({
			booking: {
				findFirst: mock.fn(async () => null),
			},
			availabilitySlot: {
				findUnique: mock.fn(async () => ({
					id: "slot-1",
					active: true,
					service: { id: "svc-1" },
				})),
				updateMany: mock.fn(async () => ({ count: 0 })),
				fields: { capacity: true },
			},
		});

		await assert.rejects(
			() => createBooking({ prisma, data: validBookingData }),
			(err) => {
				assert.equal(err.message, "Time slot is fully booked");
				assert.equal(err.code, "SLOT_FULL");
				return true;
			},
		);
	});
});

describe("cancelBooking", () => {
	it("cancels a confirmed booking", async () => {
		const startTime = new Date("2026-07-28T10:00:00.000Z");
		const prisma = mockPrisma({
			booking: {
				findUnique: mock.fn(async () => ({
					id: "booking-1",
					status: "CONFIRMED",
					durationMinutes: 30,
					serviceTypeId: "svc-1",
					slot: {
						id: "slot-1",
						startTime,
						slotScopeKey: "svc-1",
					},
				})),
				update: mock.fn(async (args) => ({
					id: "booking-1",
					...args.data,
				})),
			},
			availabilitySlot: {
				findMany: mock.fn(async () => [{ id: "slot-1" }]),
				updateMany: mock.fn(async () => ({ count: 1 })),
				fields: {},
			},
		});

		const result = await cancelBooking({
			prisma,
			bookingId: "booking-1",
			data: { cancelledReason: "Changed plans" },
		});

		assert.equal(result.status, "CANCELLED");
		assert.equal(result.cancelledReason, "Changed plans");
		assert.ok(result.cancelledAt instanceof Date);

		assert.equal(prisma.booking.update.mock.callCount(), 1);
		assert.equal(prisma.availabilitySlot.updateMany.mock.callCount(), 1);
	});

	it("throws when booking is not found", async () => {
		const prisma = mockPrisma({
			booking: {
				findUnique: mock.fn(async () => null),
			},
		});

		await assert.rejects(
			() =>
				cancelBooking({
					prisma,
					bookingId: "missing",
					data: {},
				}),
			(err) => {
				assert.equal(err.message, "Booking not found");
				assert.equal(err.code, "BOOKING_NOT_FOUND");
				return true;
			},
		);
	});

	it("throws when transition is invalid", async () => {
		const prisma = mockPrisma({
			booking: {
				findUnique: mock.fn(async () => ({
					id: "booking-1",
					status: "COMPLETED",
					durationMinutes: 30,
					serviceTypeId: "svc-1",
					slot: {
						id: "slot-1",
						startTime: new Date(),
						slotScopeKey: "svc-1",
					},
				})),
			},
		});

		await assert.rejects(
			() =>
				cancelBooking({
					prisma,
					bookingId: "booking-1",
					data: {},
				}),
			(err) => {
				assert.match(err.message, /Cannot cancel booking/);
				assert.equal(err.code, "INVALID_TRANSITION");
				return true;
			},
		);
	});
});

describe("findBookings", () => {
	it("returns bookings and total", async () => {
		const bookings = [
			{ id: "b1", name: "Alice" },
			{ id: "b2", name: "Bob" },
		];

		const prisma = mockPrisma({
			booking: {
				findMany: mock.fn(async () => bookings),
				count: mock.fn(async () => 2),
			},
		});

		const result = await findBookings({ prisma, filters: {} });

		assert.deepEqual(result.bookings, bookings);
		assert.equal(result.total, 2);
		assert.equal(prisma.booking.findMany.mock.callCount(), 1);
		assert.equal(prisma.booking.count.mock.callCount(), 1);
	});

	it("applies status and pagination filters", async () => {
		const prisma = mockPrisma({
			booking: {
				findMany: mock.fn(async () => []),
				count: mock.fn(async () => 0),
			},
		});

		await findBookings({
			prisma,
			filters: {
				status: "CONFIRMED",
				serviceId: "svc-1",
				staffId: "staff-1",
				page: 2,
				pageSize: 10,
			},
		});

		const args = prisma.booking.findMany.mock.calls[0].arguments[0];
		assert.equal(args.where.status, "CONFIRMED");
		assert.equal(args.where.serviceTypeId, "svc-1");
		assert.equal(args.where.staffId, "staff-1");
		assert.equal(args.skip, 10);
		assert.equal(args.take, 10);
	});

	it("applies search filter", async () => {
		const prisma = mockPrisma({
			booking: {
				findMany: mock.fn(async () => []),
				count: mock.fn(async () => 0),
			},
		});

		await findBookings({
			prisma,
			filters: { search: "jane" },
		});

		const args = prisma.booking.findMany.mock.calls[0].arguments[0];
		assert.deepEqual(args.where.OR, [
			{ name: { contains: "jane", mode: "insensitive" } },
			{ email: { contains: "jane", mode: "insensitive" } },
		]);
	});
});

describe("findBookingByCancelToken", () => {
	it("returns booking when found", async () => {
		const booking = {
			id: "booking-1",
			cancelToken: "tok-abc",
			status: "CONFIRMED",
		};

		const prisma = mockPrisma({
			booking: {
				findUnique: mock.fn(async () => booking),
			},
		});

		const result = await findBookingByCancelToken({
			prisma,
			token: "tok-abc",
		});

		assert.equal(result.id, "booking-1");
		const args = prisma.booking.findUnique.mock.calls[0].arguments[0];
		assert.deepEqual(args.where, { cancelToken: "tok-abc" });
		assert.ok(args.include.slot);
		assert.ok(args.include.serviceType);
		assert.ok(args.include.staff);
	});

	it("returns null when not found", async () => {
		const prisma = mockPrisma({
			booking: {
				findUnique: mock.fn(async () => null),
			},
		});

		const result = await findBookingByCancelToken({
			prisma,
			token: "missing",
		});

		assert.equal(result, null);
	});
});
