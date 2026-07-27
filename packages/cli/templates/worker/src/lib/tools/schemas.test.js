import assert from "node:assert";
import { describe, test } from "node:test";
import {
	createCompanySchema,
	createContactSchema,
	createContextSchema,
	createDealSchema,
	deleteContextSchema,
	getContextSchema,
	getConversationHistorySchema,
	searchCompaniesSchema,
	searchContactsSchema,
	searchContextSchema,
	searchDealsSchema,
	searchJobsSchema,
	toolSchemas,
	updateCompanySchema,
	updateContactSchema,
	updateContextSchema,
	updateDealSchema,
	webSearchSchema,
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

// ── getContextSchema ─────────────────────────────────────────────────────────

describe("getContextSchema", () => {
	test("validates correct input", () => {
		const result = getContextSchema.parse({});
		assert.strictEqual(result.limit, 10);
	});

	test("accepts optional free-form category", () => {
		const result = getContextSchema.parse({ category: "business.client" });
		assert.strictEqual(result.category, "business.client");
	});

	test("accepts any string category (no enum restriction)", () => {
		const result = getContextSchema.parse({ category: "custom.namespace" });
		assert.strictEqual(result.category, "custom.namespace");
	});
});

// ── createContextSchema ─────────────────────────────────────────────────────

describe("createContextSchema", () => {
	test("validates correct input", () => {
		const result = createContextSchema.parse({
			key: "client.acme.industry",
			value: "Technology",
			category: "client",
		});
		assert.strictEqual(result.key, "client.acme.industry");
		assert.strictEqual(result.source, "ai"); // default
	});

	test("rejects missing key", () => {
		assert.throws(() =>
			createContextSchema.parse({ value: "test", category: "client" }),
		);
	});

	test("rejects missing value", () => {
		assert.throws(() =>
			createContextSchema.parse({ key: "test", category: "client" }),
		);
	});

	test("rejects missing category", () => {
		assert.throws(() =>
			createContextSchema.parse({ key: "test", value: "test" }),
		);
	});

	test("rejects invalid source", () => {
		assert.throws(() =>
			createContextSchema.parse({
				key: "test",
				value: "test",
				category: "client",
				source: "invalid",
			}),
		);
	});

	test("accepts ai source", () => {
		const result = createContextSchema.parse({
			key: "test",
			value: "test",
			category: "client",
			source: "ai",
		});
		assert.strictEqual(result.source, "ai");
	});

	test("accepts seed source", () => {
		const result = createContextSchema.parse({
			key: "test",
			value: "test",
			category: "client",
			source: "seed",
		});
		assert.strictEqual(result.source, "seed");
	});

	test("accepts manual source", () => {
		const result = createContextSchema.parse({
			key: "test",
			value: "test",
			category: "client",
			source: "manual",
		});
		assert.strictEqual(result.source, "manual");
	});
});

// ── updateContextSchema ─────────────────────────────────────────────────────

describe("updateContextSchema", () => {
	test("validates correct input", () => {
		const result = updateContextSchema.parse({ id: "ctx-1" });
		assert.strictEqual(result.id, "ctx-1");
	});

	test("rejects missing id", () => {
		assert.throws(() => updateContextSchema.parse({}));
	});

	test("accepts partial updates", () => {
		const result = updateContextSchema.parse({
			id: "ctx-1",
			value: "new value",
		});
		assert.strictEqual(result.value, "new value");
	});
});

// ── deleteContextSchema ─────────────────────────────────────────────────────

describe("deleteContextSchema", () => {
	test("validates correct input", () => {
		const result = deleteContextSchema.parse({ id: "ctx-1" });
		assert.strictEqual(result.id, "ctx-1");
	});

	test("rejects missing id", () => {
		assert.throws(() => deleteContextSchema.parse({}));
	});
});

// ── searchContextSchema ─────────────────────────────────────────────────────

describe("searchContextSchema", () => {
	test("validates correct input", () => {
		const result = searchContextSchema.parse({ query: "acme" });
		assert.strictEqual(result.query, "acme");
		assert.strictEqual(result.limit, 10);
	});

	test("rejects empty query", () => {
		assert.throws(() => searchContextSchema.parse({ query: "" }));
	});

	test("rejects missing query", () => {
		assert.throws(() => searchContextSchema.parse({}));
	});

	test("accepts optional category filter", () => {
		const result = searchContextSchema.parse({
			query: "acme",
			category: "client",
		});
		assert.strictEqual(result.category, "client");
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

// ── webSearchSchema ──────────────────────────────────────────────────────────

describe("webSearchSchema", () => {
	test("validates correct input", () => {
		const result = webSearchSchema.parse({ query: "latest AI news" });
		assert.strictEqual(result.query, "latest AI news");
		assert.strictEqual(result.maxResults, 5); // default
	});

	test("rejects empty query", () => {
		assert.throws(() => webSearchSchema.parse({ query: "" }));
	});

	test("rejects missing query", () => {
		assert.throws(() => webSearchSchema.parse({}));
	});

	test("defaults maxResults to 5", () => {
		const result = webSearchSchema.parse({ query: "test" });
		assert.strictEqual(result.maxResults, 5);
	});

	test("accepts custom maxResults within limit", () => {
		const result = webSearchSchema.parse({ query: "test", maxResults: 8 });
		assert.strictEqual(result.maxResults, 8);
	});

	test("rejects maxResults > 10", () => {
		assert.throws(() =>
			webSearchSchema.parse({ query: "test", maxResults: 11 }),
		);
	});

	test("rejects zero maxResults", () => {
		assert.throws(() =>
			webSearchSchema.parse({ query: "test", maxResults: 0 }),
		);
	});

	test("rejects negative maxResults", () => {
		assert.throws(() =>
			webSearchSchema.parse({ query: "test", maxResults: -1 }),
		);
	});

	test("rejects non-integer maxResults", () => {
		assert.throws(() =>
			webSearchSchema.parse({ query: "test", maxResults: 1.5 }),
		);
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
			"get_context",
			"create_context",
			"update_context",
			"delete_context",
			"search_context",
			"search_jobs",
			"web_search",
		];

		for (const name of expectedTools) {
			assert.ok(toolSchemas[name], `Missing schema for ${name}`);
		}
		assert.strictEqual(Object.keys(toolSchemas).length, 17);
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
