import assert from "node:assert";
import { describe, test } from "node:test";
import {
	createBusinessContextSchema,
	createCompanySchema,
	createContactSchema,
	createDealSchema,
	getBusinessContextSchema,
	getConversationHistorySchema,
	searchCompaniesSchema,
	searchContactsSchema,
	searchDealsSchema,
	searchJobsSchema,
	toolSchemas,
	updateCompanySchema,
	updateContactSchema,
	updateDealSchema,
} from "./schemas.js";

// ── searchContactsSchema ─────────────────────────────────────────────────────

describe("searchContactsSchema", () => {
	test("validates correct input", () => {
		const result = searchContactsSchema.parse({ query: "john" });
		assert.strictEqual(result.query, "john");
		assert.strictEqual(result.limit, 10); // default
	});

	test("accepts optional companyId", () => {
		const result = searchContactsSchema.parse({
			query: "john",
			companyId: "comp-1",
		});
		assert.strictEqual(result.companyId, "comp-1");
	});

	test("rejects empty query", () => {
		assert.throws(() => searchContactsSchema.parse({ query: "" }));
	});

	test("rejects missing query", () => {
		assert.throws(() => searchContactsSchema.parse({}));
	});

	test("enforces max limit of 50", () => {
		assert.throws(() =>
			searchContactsSchema.parse({ query: "test", limit: 51 }),
		);
	});

	test("accepts custom limit", () => {
		const result = searchContactsSchema.parse({ query: "test", limit: 25 });
		assert.strictEqual(result.limit, 25);
	});
});

// ── createContactSchema ──────────────────────────────────────────────────────

describe("createContactSchema", () => {
	test("validates correct input", () => {
		const result = createContactSchema.parse({
			firstName: "John",
			lastName: "Doe",
		});
		assert.strictEqual(result.firstName, "John");
		assert.strictEqual(result.lastName, "Doe");
	});

	test("accepts optional fields", () => {
		const result = createContactSchema.parse({
			firstName: "John",
			lastName: "Doe",
			email: "john@example.com",
			phone: "555-0100",
			position: "Engineer",
			companyId: "comp-1",
			notes: "Test notes",
		});
		assert.strictEqual(result.email, "john@example.com");
		assert.strictEqual(result.position, "Engineer");
	});

	test("rejects missing firstName", () => {
		assert.throws(() => createContactSchema.parse({ lastName: "Doe" }));
	});

	test("rejects missing lastName", () => {
		assert.throws(() => createContactSchema.parse({ firstName: "John" }));
	});

	test("rejects invalid email", () => {
		assert.throws(() =>
			createContactSchema.parse({
				firstName: "John",
				lastName: "Doe",
				email: "not-an-email",
			}),
		);
	});

	test("accepts valid email", () => {
		const result = createContactSchema.parse({
			firstName: "John",
			lastName: "Doe",
			email: "john@example.com",
		});
		assert.strictEqual(result.email, "john@example.com");
	});
});

// ── updateContactSchema ──────────────────────────────────────────────────────

describe("updateContactSchema", () => {
	test("validates correct input", () => {
		const result = updateContactSchema.parse({ id: "contact-1" });
		assert.strictEqual(result.id, "contact-1");
	});

	test("rejects missing id", () => {
		assert.throws(() => updateContactSchema.parse({}));
	});

	test("accepts partial updates", () => {
		const result = updateContactSchema.parse({
			id: "contact-1",
			firstName: "Jane",
		});
		assert.strictEqual(result.firstName, "Jane");
	});

	test("accepts null for companyId", () => {
		const result = updateContactSchema.parse({
			id: "contact-1",
			companyId: null,
		});
		assert.strictEqual(result.companyId, null);
	});

	test("rejects invalid email on update", () => {
		assert.throws(() =>
			updateContactSchema.parse({ id: "contact-1", email: "bad" }),
		);
	});
});

// ── searchCompaniesSchema ────────────────────────────────────────────────────

describe("searchCompaniesSchema", () => {
	test("validates correct input", () => {
		const result = searchCompaniesSchema.parse({ query: "acme" });
		assert.strictEqual(result.query, "acme");
		assert.strictEqual(result.limit, 10);
	});

	test("rejects missing query", () => {
		assert.throws(() => searchCompaniesSchema.parse({}));
	});

	test("accepts optional industry", () => {
		const result = searchCompaniesSchema.parse({
			query: "acme",
			industry: "tech",
		});
		assert.strictEqual(result.industry, "tech");
	});
});

// ── createCompanySchema ──────────────────────────────────────────────────────

describe("createCompanySchema", () => {
	test("validates correct input", () => {
		const result = createCompanySchema.parse({ name: "Acme Corp" });
		assert.strictEqual(result.name, "Acme Corp");
	});

	test("rejects missing name", () => {
		assert.throws(() => createCompanySchema.parse({}));
	});

	test("accepts optional website", () => {
		const result = createCompanySchema.parse({
			name: "Acme",
			website: "https://acme.com",
		});
		assert.strictEqual(result.website, "https://acme.com");
	});

	test("rejects invalid website URL", () => {
		assert.throws(() =>
			createCompanySchema.parse({ name: "Acme", website: "not-a-url" }),
		);
	});
});

// ── updateCompanySchema ──────────────────────────────────────────────────────

describe("updateCompanySchema", () => {
	test("validates correct input", () => {
		const result = updateCompanySchema.parse({ id: "comp-1" });
		assert.strictEqual(result.id, "comp-1");
	});

	test("rejects missing id", () => {
		assert.throws(() => updateCompanySchema.parse({}));
	});

	test("accepts null for nullable fields", () => {
		const result = updateCompanySchema.parse({
			id: "comp-1",
			website: null,
			industry: null,
		});
		assert.strictEqual(result.website, null);
		assert.strictEqual(result.industry, null);
	});
});

// ── searchDealsSchema ────────────────────────────────────────────────────────

describe("searchDealsSchema", () => {
	test("validates correct input", () => {
		const result = searchDealsSchema.parse({ query: "enterprise" });
		assert.strictEqual(result.query, "enterprise");
	});

	test("rejects invalid stage enum", () => {
		assert.throws(() =>
			searchDealsSchema.parse({ query: "test", stage: "INVALID" }),
		);
	});

	test("accepts valid stage enum", () => {
		const result = searchDealsSchema.parse({ query: "test", stage: "LEAD" });
		assert.strictEqual(result.stage, "LEAD");
	});

	test("accepts all valid stages", () => {
		const stages = [
			"LEAD",
			"QUALIFIED",
			"PROPOSAL",
			"NEGOTIATION",
			"CLOSED_WON",
			"CLOSED_LOST",
		];
		for (const stage of stages) {
			const result = searchDealsSchema.parse({ query: "test", stage });
			assert.strictEqual(result.stage, stage);
		}
	});
});

// ── createDealSchema ─────────────────────────────────────────────────────────

describe("createDealSchema", () => {
	test("validates correct input", () => {
		const result = createDealSchema.parse({ title: "Big Deal" });
		assert.strictEqual(result.title, "Big Deal");
		assert.strictEqual(result.value, 0); // default
		assert.strictEqual(result.stage, "LEAD"); // default
		assert.strictEqual(result.probability, 10); // default
	});

	test("rejects missing title", () => {
		assert.throws(() => createDealSchema.parse({}));
	});

	test("rejects negative value", () => {
		assert.throws(() => createDealSchema.parse({ title: "Deal", value: -100 }));
	});

	test("accepts optional expectedCloseDate", () => {
		const result = createDealSchema.parse({
			title: "Deal",
			expectedCloseDate: "2025-12-31T00:00:00.000Z",
		});
		assert.strictEqual(result.expectedCloseDate, "2025-12-31T00:00:00.000Z");
	});

	test("rejects invalid expectedCloseDate", () => {
		assert.throws(() =>
			createDealSchema.parse({
				title: "Deal",
				expectedCloseDate: "not-a-date",
			}),
		);
	});
});

// ── updateDealSchema ─────────────────────────────────────────────────────────

describe("updateDealSchema", () => {
	test("validates correct input", () => {
		const result = updateDealSchema.parse({ id: "deal-1" });
		assert.strictEqual(result.id, "deal-1");
	});

	test("rejects missing id", () => {
		assert.throws(() => updateDealSchema.parse({}));
	});

	test("accepts null for nullable fields", () => {
		const result = updateDealSchema.parse({
			id: "deal-1",
			contactId: null,
			companyId: null,
			expectedCloseDate: null,
		});
		assert.strictEqual(result.contactId, null);
	});
});

// ── getConversationHistorySchema ─────────────────────────────────────────────

describe("getConversationHistorySchema", () => {
	test("validates correct input", () => {
		const result = getConversationHistorySchema.parse({
			conversationId: "conv-1",
		});
		assert.strictEqual(result.conversationId, "conv-1");
		assert.strictEqual(result.limit, 20); // default
	});

	test("rejects missing conversationId", () => {
		assert.throws(() => getConversationHistorySchema.parse({}));
	});

	test("accepts optional before datetime", () => {
		const result = getConversationHistorySchema.parse({
			conversationId: "conv-1",
			before: "2025-01-01T00:00:00.000Z",
		});
		assert.ok(result.before);
	});
});

// ── getBusinessContextSchema ─────────────────────────────────────────────────

describe("getBusinessContextSchema", () => {
	test("validates correct input", () => {
		const result = getBusinessContextSchema.parse({});
		assert.strictEqual(result.limit, 10);
	});

	test("accepts optional category", () => {
		const result = getBusinessContextSchema.parse({ category: "billing" });
		assert.strictEqual(result.category, "billing");
	});

	test("rejects invalid category", () => {
		assert.throws(() =>
			getBusinessContextSchema.parse({ category: "invalid" }),
		);
	});

	test("accepts all valid categories", () => {
		const categories = [
			"billing",
			"client",
			"task",
			"tech_note",
			"process",
			"preference",
		];
		for (const cat of categories) {
			const result = getBusinessContextSchema.parse({ category: cat });
			assert.strictEqual(result.category, cat);
		}
	});
});

// ── createBusinessContextSchema ──────────────────────────────────────────────

describe("createBusinessContextSchema", () => {
	test("validates correct input", () => {
		const result = createBusinessContextSchema.parse({
			key: "client.acme.industry",
			value: "Technology",
			category: "client",
		});
		assert.strictEqual(result.key, "client.acme.industry");
		assert.strictEqual(result.source, "learned"); // default
	});

	test("rejects missing key", () => {
		assert.throws(() =>
			createBusinessContextSchema.parse({ value: "test", category: "client" }),
		);
	});

	test("rejects missing value", () => {
		assert.throws(() =>
			createBusinessContextSchema.parse({ key: "test", category: "client" }),
		);
	});

	test("rejects invalid source", () => {
		assert.throws(() =>
			createBusinessContextSchema.parse({
				key: "test",
				value: "test",
				category: "client",
				source: "invalid",
			}),
		);
	});

	test("accepts seed source", () => {
		const result = createBusinessContextSchema.parse({
			key: "test",
			value: "test",
			category: "client",
			source: "seed",
		});
		assert.strictEqual(result.source, "seed");
	});
});

// ── searchJobsSchema ─────────────────────────────────────────────────────────

describe("searchJobsSchema", () => {
	test("validates correct input", () => {
		const result = searchJobsSchema.parse({ query: "email" });
		assert.strictEqual(result.query, "email");
		assert.strictEqual(result.limit, 10);
	});

	test("rejects missing query", () => {
		assert.throws(() => searchJobsSchema.parse({}));
	});

	test("accepts optional status", () => {
		const result = searchJobsSchema.parse({ query: "test", status: "PENDING" });
		assert.strictEqual(result.status, "PENDING");
	});

	test("rejects invalid status", () => {
		assert.throws(() =>
			searchJobsSchema.parse({ query: "test", status: "INVALID" }),
		);
	});

	test("accepts all valid statuses", () => {
		const statuses = [
			"PENDING",
			"IN_PROGRESS",
			"COMPLETED",
			"FAILED",
			"CANCELLED",
		];
		for (const status of statuses) {
			const result = searchJobsSchema.parse({ query: "test", status });
			assert.strictEqual(result.status, status);
		}
	});
});

// ── toolSchemas registry ─────────────────────────────────────────────────────

describe("toolSchemas registry", () => {
	test("contains all expected tool schemas", () => {
		const expectedTools = [
			"search_contacts",
			"create_contact",
			"update_contact",
			"search_companies",
			"create_company",
			"update_company",
			"search_deals",
			"create_deal",
			"update_deal",
			"get_conversation_history",
			"get_business_context",
			"create_business_context",
			"search_jobs",
		];

		for (const name of expectedTools) {
			assert.ok(toolSchemas[name], `Missing schema for ${name}`);
		}
		assert.strictEqual(Object.keys(toolSchemas).length, 13);
	});

	test("each schema is a Zod schema with parse method", () => {
		for (const [name, schema] of Object.entries(toolSchemas)) {
			assert.strictEqual(
				typeof schema.parse,
				"function",
				`${name} should have parse method`,
			);
			assert.strictEqual(
				typeof schema.safeParse,
				"function",
				`${name} should have safeParse method`,
			);
		}
	});
});
