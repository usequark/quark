import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { companySchema, contactSchema, dealSchema } from "./validation.js";

describe("contactSchema", () => {
	it("accepts a minimal valid contact", () => {
		const result = contactSchema.safeParse({
			firstName: "Jane",
			lastName: "Doe",
		});
		assert.ok(result.success);
	});

	it("rejects missing firstName", () => {
		const result = contactSchema.safeParse({ lastName: "Doe" });
		assert.ok(!result.success);
	});

	it("rejects empty firstName", () => {
		const result = contactSchema.safeParse({ firstName: "", lastName: "Doe" });
		assert.ok(!result.success);
	});

	it("rejects missing lastName", () => {
		const result = contactSchema.safeParse({ firstName: "Jane" });
		assert.ok(!result.success);
	});

	it("accepts optional email if valid", () => {
		const result = contactSchema.safeParse({
			firstName: "Jane",
			lastName: "Doe",
			email: "jane@example.com",
		});
		assert.ok(result.success);
	});

	it("rejects invalid email", () => {
		const result = contactSchema.safeParse({
			firstName: "Jane",
			lastName: "Doe",
			email: "not-an-email",
		});
		assert.ok(!result.success);
	});

	it("accepts empty string email", () => {
		const result = contactSchema.safeParse({
			firstName: "Jane",
			lastName: "Doe",
			email: "",
		});
		assert.ok(result.success);
	});

	it("accepts all optional fields", () => {
		const result = contactSchema.safeParse({
			firstName: "Jane",
			lastName: "Doe",
			email: "jane@example.com",
			phone: "+1-555-0100",
			position: "Engineer",
			notes: "Met at conference",
			companyId: "cmp-1",
		});
		assert.ok(result.success);
	});
});

describe("companySchema", () => {
	it("accepts a minimal valid company", () => {
		const result = companySchema.safeParse({ name: "Acme Corp" });
		assert.ok(result.success);
	});

	it("rejects missing name", () => {
		const result = companySchema.safeParse({});
		assert.ok(!result.success);
	});

	it("rejects empty name", () => {
		const result = companySchema.safeParse({ name: "" });
		assert.ok(!result.success);
	});

	it("accepts all optional fields", () => {
		const result = companySchema.safeParse({
			name: "Acme Corp",
			website: "https://acme.com",
			industry: "Technology",
			size: "51-200",
			notes: "Key enterprise account",
		});
		assert.ok(result.success);
	});

	it("accepts empty optional fields", () => {
		const result = companySchema.safeParse({
			name: "Acme Corp",
			website: "",
			industry: "",
			size: "",
			notes: "",
		});
		assert.ok(result.success);
	});
});

describe("dealSchema", () => {
	it("accepts a minimal valid deal", () => {
		const result = dealSchema.safeParse({ title: "Big Deal" });
		assert.ok(result.success);
	});

	it("rejects missing title", () => {
		const result = dealSchema.safeParse({});
		assert.ok(!result.success);
	});

	it("rejects empty title", () => {
		const result = dealSchema.safeParse({ title: "" });
		assert.ok(!result.success);
	});

	it("defaults stage to LEAD", () => {
		const result = dealSchema.parse({ title: "Test" });
		assert.equal(result.stage, "LEAD");
	});

	it("defaults value to 0", () => {
		const result = dealSchema.parse({ title: "Test" });
		assert.equal(result.value, 0);
	});

	it("defaults probability to 10", () => {
		const result = dealSchema.parse({ title: "Test" });
		assert.equal(result.probability, 10);
	});

	it("accepts a valid stage", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			stage: "NEGOTIATION",
		});
		assert.ok(result.success);
	});

	it("rejects an invalid stage", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			stage: "INVALID_STAGE",
		});
		assert.ok(!result.success);
	});

	it("coerces string value to number", () => {
		const result = dealSchema.parse({ title: "Test", value: "5000" });
		assert.equal(result.value, 5000);
	});

	it("rejects negative value", () => {
		const result = dealSchema.safeParse({ title: "Test", value: -100 });
		assert.ok(!result.success);
	});

	it("rejects probability below 0", () => {
		const result = dealSchema.safeParse({ title: "Test", probability: -1 });
		assert.ok(!result.success);
	});

	it("rejects probability above 100", () => {
		const result = dealSchema.safeParse({ title: "Test", probability: 101 });
		assert.ok(!result.success);
	});

	it("accepts optional contactId and companyId", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			contactId: "con-1",
			companyId: "cmp-1",
		});
		assert.ok(result.success);
	});

	it("transforms expectedCloseDate empty string to undefined", () => {
		const result = dealSchema.parse({
			title: "Test",
			expectedCloseDate: "",
		});
		assert.equal(result.expectedCloseDate, undefined);
	});
});
