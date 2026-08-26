import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_CRM_CONFIG } from "./config.js";
import { generateSchema, schemasFromConfig } from "./validation.js";

const {
	contact: contactSchema,
	company: companySchema,
	deal: dealSchema,
} = schemasFromConfig(DEFAULT_CRM_CONFIG);

describe("contactSchema (from schemasFromConfig)", () => {
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

	it("uses humanized key in required error messages", () => {
		const result = contactSchema.safeParse({ lastName: "Doe" });
		assert.ok(!result.success);
		const message = result.error.issues[0]?.message ?? "";
		assert.ok(
			message.includes("First Name"),
			`expected humanized label in message, got: ${message}`,
		);
	});
});

describe("companySchema (from schemasFromConfig)", () => {
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

describe("dealSchema (from schemasFromConfig)", () => {
	it("accepts a minimal valid deal", () => {
		const result = dealSchema.safeParse({
			title: "Big Deal",
			value: 0,
			probability: 10,
		});
		assert.ok(result.success);
	});

	it("rejects missing title", () => {
		const result = dealSchema.safeParse({ value: 0, probability: 10 });
		assert.ok(!result.success);
	});

	it("rejects empty title", () => {
		const result = dealSchema.safeParse({
			title: "",
			value: 0,
			probability: 10,
		});
		assert.ok(!result.success);
	});

	it("defaults stage to LEAD", () => {
		const result = dealSchema.parse({
			title: "Test",
			value: 0,
			probability: 10,
		});
		assert.equal(result.stage, "LEAD");
	});

	it("accepts a valid stage", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			value: 0,
			probability: 10,
			stage: "NEGOTIATION",
		});
		assert.ok(result.success);
	});

	it("rejects an invalid stage", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			value: 0,
			probability: 10,
			stage: "INVALID_STAGE",
		});
		assert.ok(!result.success);
	});

	it("coerces string value to number", () => {
		const result = dealSchema.parse({
			title: "Test",
			value: "5000",
			probability: 10,
		});
		assert.equal(result.value, 5000);
	});

	it("rejects negative value", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			value: -100,
			probability: 10,
		});
		assert.ok(!result.success);
	});

	it("rejects probability below 0", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			value: 0,
			probability: -1,
		});
		assert.ok(!result.success);
	});

	it("rejects probability above 100", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			value: 0,
			probability: 101,
		});
		assert.ok(!result.success);
	});

	it("accepts optional contactId and companyId", () => {
		const result = dealSchema.safeParse({
			title: "Test",
			value: 0,
			probability: 10,
			contactId: "con-1",
			companyId: "cmp-1",
		});
		assert.ok(result.success);
	});

	it("transforms expectedCloseDate empty string to undefined", () => {
		const result = dealSchema.parse({
			title: "Test",
			value: 0,
			probability: 10,
			expectedCloseDate: "",
		});
		assert.equal(result.expectedCloseDate, undefined);
	});
});

describe("generateSchema", () => {
	it("builds a schema from label-less field definitions", () => {
		const schema = generateSchema([
			{ key: "name", type: "text", required: true },
			{ key: "notes", type: "textarea" },
		]);
		assert.ok(schema.safeParse({ name: "Acme" }).success);
		assert.ok(!schema.safeParse({}).success);
		assert.ok(schema.safeParse({ name: "Acme", notes: "" }).success);
	});

	it("uses humanized keys in required error messages", () => {
		const schema = generateSchema([
			{ key: "firstName", type: "text", required: true },
		]);
		const result = schema.safeParse({});
		assert.ok(!result.success);
		const message = result.error.issues[0]?.message ?? "";
		assert.ok(
			message.includes("First Name"),
			`expected humanized label in message, got: ${message}`,
		);
	});

	it("respects explicit label overrides in error messages", () => {
		const schema = generateSchema([
			{
				key: "expectedCloseDate",
				label: "Close By",
				type: "text",
				required: true,
			},
		]);
		const result = schema.safeParse({});
		assert.ok(!result.success);
		const message = result.error.issues[0]?.message ?? "";
		assert.ok(
			message.includes("Close By"),
			`expected override label in message, got: ${message}`,
		);
	});

	it("matches schemasFromConfig for entity/actor/container fields", () => {
		const entity = generateSchema(DEFAULT_CRM_CONFIG.fields.entity);
		const actor = generateSchema(DEFAULT_CRM_CONFIG.fields.actor);
		const container = generateSchema(DEFAULT_CRM_CONFIG.fields.container);

		assert.ok(
			entity.safeParse({ title: "X", value: 0, probability: 10 }).success,
		);
		assert.ok(actor.safeParse({ firstName: "A", lastName: "B" }).success);
		assert.ok(container.safeParse({ name: "Co" }).success);
	});

	it("uses custom pipeline stages from config", () => {
		const customConfig = {
			...DEFAULT_CRM_CONFIG,
			pipelineStages: [
				{
					key: "OPEN",
					label: "Open",
					color: "default",
					probability: 50,
					next: [],
				},
			],
		};
		const schema = generateSchema(customConfig.fields.entity, customConfig);
		assert.ok(
			schema.safeParse({
				title: "X",
				value: 0,
				probability: 10,
				stage: "OPEN",
			}).success,
		);
		assert.ok(
			!schema.safeParse({
				title: "X",
				value: 0,
				probability: 10,
				stage: "LEAD",
			}).success,
		);
	});
});
