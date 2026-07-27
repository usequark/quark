import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	bookingSchema,
	cancelBookingSchema,
	serviceTypeSchema,
	slotSchema,
} from "./validation.js";

describe("bookingSchema", () => {
	const validBooking = {
		name: "Jane Doe",
		email: "jane@example.com",
		slotId: "slot-1",
		serviceTypeId: "svc-1",
	};

	it("accepts a minimal valid booking", () => {
		const result = bookingSchema.safeParse(validBooking);
		assert.ok(result.success);
		assert.equal(result.data.durationMinutes, 30);
	});

	it("accepts all optional fields", () => {
		const result = bookingSchema.safeParse({
			...validBooking,
			phone: "+1-555-0100",
			notes: "Prefer morning",
			staffId: "staff-1",
			durationMinutes: 60,
		});
		assert.ok(result.success);
		assert.equal(result.data.durationMinutes, 60);
		assert.equal(result.data.phone, "+1-555-0100");
		assert.equal(result.data.notes, "Prefer morning");
		assert.equal(result.data.staffId, "staff-1");
	});

	it("rejects missing name", () => {
		const { name: _name, ...rest } = validBooking;
		const result = bookingSchema.safeParse(rest);
		assert.ok(!result.success);
	});

	it("rejects empty name", () => {
		const result = bookingSchema.safeParse({ ...validBooking, name: "" });
		assert.ok(!result.success);
	});

	it("rejects missing email", () => {
		const { email: _email, ...rest } = validBooking;
		const result = bookingSchema.safeParse(rest);
		assert.ok(!result.success);
	});

	it("rejects invalid email", () => {
		const result = bookingSchema.safeParse({
			...validBooking,
			email: "not-an-email",
		});
		assert.ok(!result.success);
	});

	it("rejects missing slotId", () => {
		const { slotId: _slotId, ...rest } = validBooking;
		const result = bookingSchema.safeParse(rest);
		assert.ok(!result.success);
	});

	it("rejects empty slotId", () => {
		const result = bookingSchema.safeParse({ ...validBooking, slotId: "" });
		assert.ok(!result.success);
	});

	it("rejects missing serviceTypeId", () => {
		const { serviceTypeId: _id, ...rest } = validBooking;
		const result = bookingSchema.safeParse(rest);
		assert.ok(!result.success);
	});

	it("rejects non-positive durationMinutes", () => {
		const result = bookingSchema.safeParse({
			...validBooking,
			durationMinutes: 0,
		});
		assert.ok(!result.success);
	});

	it("rejects phone longer than 20 characters", () => {
		const result = bookingSchema.safeParse({
			...validBooking,
			phone: "1".repeat(21),
		});
		assert.ok(!result.success);
	});
});

describe("serviceTypeSchema", () => {
	it("accepts a minimal valid service type", () => {
		const result = serviceTypeSchema.safeParse({
			name: "Consultation",
			duration: 30,
		});
		assert.ok(result.success);
		assert.equal(result.data.capacity, 1);
		assert.equal(result.data.active, true);
	});

	it("accepts all optional fields", () => {
		const result = serviceTypeSchema.safeParse({
			name: "Deep Clean",
			description: "Full service",
			duration: 60,
			price: 99.5,
			capacity: 2,
			active: false,
		});
		assert.ok(result.success);
		assert.equal(result.data.price, 99.5);
		assert.equal(result.data.capacity, 2);
		assert.equal(result.data.active, false);
	});

	it("rejects missing name", () => {
		const result = serviceTypeSchema.safeParse({ duration: 30 });
		assert.ok(!result.success);
	});

	it("rejects empty name", () => {
		const result = serviceTypeSchema.safeParse({ name: "", duration: 30 });
		assert.ok(!result.success);
	});

	it("rejects missing duration", () => {
		const result = serviceTypeSchema.safeParse({ name: "Consult" });
		assert.ok(!result.success);
	});

	it("rejects non-positive duration", () => {
		const result = serviceTypeSchema.safeParse({
			name: "Consult",
			duration: 0,
		});
		assert.ok(!result.success);
	});

	it("rejects negative price", () => {
		const result = serviceTypeSchema.safeParse({
			name: "Consult",
			duration: 30,
			price: -1,
		});
		assert.ok(!result.success);
	});
});

describe("slotSchema", () => {
	const validSlot = {
		serviceId: "svc-1",
		startTime: "2026-07-28T10:00:00.000Z",
		endTime: "2026-07-28T10:30:00.000Z",
	};

	it("accepts a minimal valid slot", () => {
		const result = slotSchema.safeParse(validSlot);
		assert.ok(result.success);
		assert.ok(result.data.startTime instanceof Date);
		assert.ok(result.data.endTime instanceof Date);
		assert.equal(result.data.capacity, 1);
	});

	it("accepts optional staffId and capacity", () => {
		const result = slotSchema.safeParse({
			...validSlot,
			staffId: "staff-1",
			capacity: 3,
		});
		assert.ok(result.success);
		assert.equal(result.data.staffId, "staff-1");
		assert.equal(result.data.capacity, 3);
	});

	it("rejects missing serviceId", () => {
		const { serviceId: _id, ...rest } = validSlot;
		const result = slotSchema.safeParse(rest);
		assert.ok(!result.success);
	});

	it("rejects empty serviceId", () => {
		const result = slotSchema.safeParse({ ...validSlot, serviceId: "" });
		assert.ok(!result.success);
	});

	it("rejects missing startTime", () => {
		const { startTime: _s, ...rest } = validSlot;
		const result = slotSchema.safeParse(rest);
		assert.ok(!result.success);
	});

	it("rejects invalid date strings", () => {
		const result = slotSchema.safeParse({
			...validSlot,
			startTime: "not-a-date",
		});
		assert.ok(!result.success);
	});

	it("rejects non-positive capacity", () => {
		const result = slotSchema.safeParse({ ...validSlot, capacity: 0 });
		assert.ok(!result.success);
	});
});

describe("cancelBookingSchema", () => {
	it("accepts empty object", () => {
		const result = cancelBookingSchema.safeParse({});
		assert.ok(result.success);
	});

	it("accepts optional cancelledReason", () => {
		const result = cancelBookingSchema.safeParse({
			cancelledReason: "Schedule conflict",
		});
		assert.ok(result.success);
		assert.equal(result.data.cancelledReason, "Schedule conflict");
	});

	it("rejects cancelledReason longer than 2000 characters", () => {
		const result = cancelBookingSchema.safeParse({
			cancelledReason: "x".repeat(2001),
		});
		assert.ok(!result.success);
	});
});
