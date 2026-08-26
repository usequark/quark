import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	checkSlotAvailability,
	generateSlots,
	releaseSlot,
} from "./availability.js";

function mockPrisma(overrides = {}) {
	return {
		availabilitySlot: {
			updateMany: mock.fn(async () => ({ count: 0 })),
			findFirst: mock.fn(async () => null),
			create: mock.fn(async (args) => ({ id: "slot-new", ...args.data })),
			fields: {},
			...overrides.availabilitySlot,
		},
		serviceType: {
			findUnique: mock.fn(async () => null),
			...overrides.serviceType,
		},
		...overrides,
	};
}

describe("checkSlotAvailability", () => {
	it("returns true when reservation succeeds", async () => {
		const prisma = mockPrisma({
			availabilitySlot: {
				updateMany: mock.fn(async () => ({ count: 1 })),
				fields: { capacity: true },
			},
		});

		const result = await checkSlotAvailability({
			prisma,
			slotId: "slot-1",
		});

		assert.equal(result, true);
		assert.equal(prisma.availabilitySlot.updateMany.mock.callCount(), 1);

		const args = prisma.availabilitySlot.updateMany.mock.calls[0].arguments[0];
		assert.equal(args.where.id, "slot-1");
		assert.equal(args.where.active, true);
		assert.deepEqual(args.data, { bookedCount: { increment: 1 } });
	});

	it("returns false when capacity is full", async () => {
		const prisma = mockPrisma({
			availabilitySlot: {
				updateMany: mock.fn(async () => ({ count: 0 })),
				fields: { capacity: true },
			},
		});

		const result = await checkSlotAvailability({
			prisma,
			slotId: "slot-full",
		});

		assert.equal(result, false);
	});
});

describe("releaseSlot", () => {
	it("decrements bookedCount for the slot", async () => {
		const prisma = mockPrisma({
			availabilitySlot: {
				updateMany: mock.fn(async () => ({ count: 1 })),
			},
		});

		await releaseSlot({ prisma, slotId: "slot-1" });

		assert.equal(prisma.availabilitySlot.updateMany.mock.callCount(), 1);
		const args = prisma.availabilitySlot.updateMany.mock.calls[0].arguments[0];
		assert.deepEqual(args.where, {
			id: "slot-1",
			bookedCount: { gt: 0 },
		});
		assert.deepEqual(args.data, {
			bookedCount: { decrement: 1 },
		});
	});

	it("does not throw when slot not found or already zero", async () => {
		const prisma = mockPrisma({
			availabilitySlot: {
				updateMany: mock.fn(async () => ({ count: 0 })),
			},
		});

		await assert.doesNotReject(() =>
			releaseSlot({ prisma, slotId: "missing" }),
		);
	});
});

/** Local midnight range for a single calendar day (avoids UTC/local dayOfWeek skew). */
function localDayRange(year, monthIndex, day) {
	const dateFrom = new Date(year, monthIndex, day, 0, 0, 0, 0);
	const dateTo = new Date(year, monthIndex, day + 1, 0, 0, 0, 0);
	return { dateFrom, dateTo, dayOfWeek: dateFrom.getDay() };
}

describe("generateSlots", () => {
	it("generates slots for matching pattern days", async () => {
		// 2026-07-27 local is a Monday
		const { dateFrom, dateTo, dayOfWeek } = localDayRange(2026, 6, 27);

		const prisma = mockPrisma({
			serviceType: {
				findUnique: mock.fn(async () => ({
					id: "svc-1",
					duration: 30,
					capacity: 2,
				})),
			},
			availabilitySlot: {
				findFirst: mock.fn(async () => null),
				create: mock.fn(async (args) => ({ id: "new", ...args.data })),
				fields: {},
			},
		});

		const result = await generateSlots({
			prisma,
			serviceId: "svc-1",
			dateFrom,
			dateTo,
			pattern: [{ dayOfWeek, times: ["09:00", "10:00"] }],
		});

		assert.equal(result.created, 2);
		assert.equal(result.skipped, 0);
		assert.equal(prisma.availabilitySlot.create.mock.callCount(), 2);

		const firstCreate =
			prisma.availabilitySlot.create.mock.calls[0].arguments[0];
		assert.equal(firstCreate.data.serviceId, "svc-1");
		assert.equal(firstCreate.data.capacity, 2);
		assert.equal(firstCreate.data.startTime.getHours(), 9);
		assert.equal(firstCreate.data.startTime.getMinutes(), 0);
		assert.equal(
			firstCreate.data.endTime.getTime() - firstCreate.data.startTime.getTime(),
			30 * 60 * 1000,
		);
	});

	it("skips existing slots", async () => {
		const { dateFrom, dateTo, dayOfWeek } = localDayRange(2026, 6, 27);

		const prisma = mockPrisma({
			serviceType: {
				findUnique: mock.fn(async () => ({
					id: "svc-1",
					duration: 30,
					capacity: 1,
				})),
			},
			availabilitySlot: {
				findFirst: mock.fn(async () => ({ id: "existing" })),
				create: mock.fn(async () => ({})),
				fields: {},
			},
		});

		const result = await generateSlots({
			prisma,
			serviceId: "svc-1",
			dateFrom,
			dateTo,
			pattern: [{ dayOfWeek, times: ["09:00"] }],
		});

		assert.equal(result.created, 0);
		assert.equal(result.skipped, 1);
		assert.equal(prisma.availabilitySlot.create.mock.callCount(), 0);
	});

	it("skips days not in pattern", async () => {
		const { dateFrom, dateTo, dayOfWeek } = localDayRange(2026, 6, 27);
		const otherDay = (dayOfWeek + 1) % 7;

		const prisma = mockPrisma({
			serviceType: {
				findUnique: mock.fn(async () => ({
					id: "svc-1",
					duration: 30,
					capacity: 1,
				})),
			},
			availabilitySlot: {
				findFirst: mock.fn(async () => null),
				create: mock.fn(async () => ({})),
				fields: {},
			},
		});

		const result = await generateSlots({
			prisma,
			serviceId: "svc-1",
			dateFrom,
			dateTo,
			pattern: [{ dayOfWeek: otherDay, times: ["09:00"] }],
		});

		assert.equal(result.created, 0);
		assert.equal(result.skipped, 0);
		assert.equal(prisma.availabilitySlot.create.mock.callCount(), 0);
	});

	it("throws ValidationError when service is not found", async () => {
		const prisma = mockPrisma({
			serviceType: {
				findUnique: mock.fn(async () => null),
			},
		});
		const { dateFrom, dateTo, dayOfWeek } = localDayRange(2026, 6, 27);

		await assert.rejects(
			() =>
				generateSlots({
					prisma,
					serviceId: "missing",
					dateFrom,
					dateTo,
					pattern: [{ dayOfWeek, times: ["09:00"] }],
				}),
			(err) => {
				assert.equal(err.message, "Service not found");
				return true;
			},
		);
	});

	it("returns zero counts when pattern is empty", async () => {
		const { dateFrom, dateTo } = localDayRange(2026, 6, 27);

		const prisma = mockPrisma({
			serviceType: {
				findUnique: mock.fn(async () => ({
					id: "svc-1",
					duration: 30,
					capacity: 1,
				})),
			},
		});

		const result = await generateSlots({
			prisma,
			serviceId: "svc-1",
			dateFrom,
			dateTo,
			pattern: [],
		});

		assert.deepEqual(result, { created: 0, skipped: 0 });
	});
});
