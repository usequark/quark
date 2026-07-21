import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
	handleCreateBusinessContext,
	handleCreateCompany,
	handleCreateContact,
	handleCreateDeal,
	handleGetBusinessContext,
	handleGetConversationHistory,
	handleSearchCompanies,
	handleSearchContacts,
	handleSearchDeals,
	handleSearchJobs,
	handleUpdateCompany,
	handleUpdateContact,
	handleUpdateDeal,
	toolHandlers,
} from "./handlers.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

let originalPrisma;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	delete globalThis.__prisma;
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	mock.restoreAll();
});

function setPrismaMock(prismaMock) {
	globalThis.__prisma = prismaMock;
	return prismaMock;
}

// ── Contact Handlers ─────────────────────────────────────────────────────────

describe("handleSearchContacts", () => {
	test("returns contacts matching query", async () => {
		const mockContacts = [
			{ id: "c1", firstName: "John", lastName: "Doe", company: null },
		];
		const prisma = setPrismaMock({
			contact: {
				findMany: mock.fn(async () => mockContacts),
			},
		});

		const result = await handleSearchContacts({ query: "john", limit: 10 });
		assert.deepStrictEqual(result.contacts, mockContacts);
		assert.strictEqual(result.count, 1);
		assert.strictEqual(prisma.contact.findMany.mock.callCount(), 1);
	});

	test("passes companyId filter when provided", async () => {
		const prisma = setPrismaMock({
			contact: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleSearchContacts({
			query: "john",
			limit: 10,
			companyId: "comp-1",
		});
		const callArgs = prisma.contact.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.companyId, "comp-1");
	});

	test("does not include companyId when not provided", async () => {
		const prisma = setPrismaMock({
			contact: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleSearchContacts({ query: "john", limit: 10 });
		const callArgs = prisma.contact.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.companyId, undefined);
	});
});

describe("handleCreateContact", () => {
	test("creates contact with correct data", async () => {
		const mockContact = {
			id: "c1",
			firstName: "John",
			lastName: "Doe",
			company: null,
		};
		const prisma = setPrismaMock({
			contact: {
				create: mock.fn(async () => mockContact),
			},
		});

		const result = await handleCreateContact({
			firstName: "John",
			lastName: "Doe",
		});
		assert.deepStrictEqual(result.contact, mockContact);
		assert.strictEqual(prisma.contact.create.mock.callCount(), 1);
	});
});

describe("handleUpdateContact", () => {
	test("updates contact with correct data", async () => {
		const mockContact = {
			id: "c1",
			firstName: "Jane",
			lastName: "Doe",
			company: null,
		};
		const prisma = setPrismaMock({
			contact: {
				update: mock.fn(async () => mockContact),
			},
		});

		const result = await handleUpdateContact({ id: "c1", firstName: "Jane" });
		assert.deepStrictEqual(result.contact, mockContact);
		assert.strictEqual(prisma.contact.update.mock.callCount(), 1);

		const callArgs = prisma.contact.update.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.id, "c1");
		assert.strictEqual(callArgs.data.firstName, "Jane");
	});
});

// ── Company Handlers ─────────────────────────────────────────────────────────

describe("handleSearchCompanies", () => {
	test("returns companies matching query", async () => {
		const mockCompanies = [
			{ id: "comp-1", name: "Acme", _count: { contacts: 5, deals: 2 } },
		];
		setPrismaMock({
			company: {
				findMany: mock.fn(async () => mockCompanies),
			},
		});

		const result = await handleSearchCompanies({ query: "acme", limit: 10 });
		assert.deepStrictEqual(result.companies, mockCompanies);
		assert.strictEqual(result.count, 1);
	});

	test("passes industry filter when provided", async () => {
		const prisma = setPrismaMock({
			company: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleSearchCompanies({ query: "acme", limit: 10, industry: "tech" });
		const callArgs = prisma.company.findMany.mock.calls[0].arguments[0];
		assert.ok(callArgs.where.industry);
	});
});

describe("handleCreateCompany", () => {
	test("creates company with correct data", async () => {
		const mockCompany = { id: "comp-1", name: "Acme" };
		setPrismaMock({
			company: {
				create: mock.fn(async () => mockCompany),
			},
		});

		const result = await handleCreateCompany({ name: "Acme" });
		assert.deepStrictEqual(result.company, mockCompany);
	});
});

describe("handleUpdateCompany", () => {
	test("updates company with correct data", async () => {
		const mockCompany = { id: "comp-1", name: "Acme Corp" };
		setPrismaMock({
			company: {
				update: mock.fn(async () => mockCompany),
			},
		});

		const result = await handleUpdateCompany({
			id: "comp-1",
			name: "Acme Corp",
		});
		assert.deepStrictEqual(result.company, mockCompany);
	});
});

// ── Deal Handlers ────────────────────────────────────────────────────────────

describe("handleSearchDeals", () => {
	test("returns deals matching query", async () => {
		const mockDeals = [
			{ id: "d1", title: "Enterprise Deal", contact: null, company: null },
		];
		setPrismaMock({
			deal: {
				findMany: mock.fn(async () => mockDeals),
			},
		});

		const result = await handleSearchDeals({ query: "enterprise", limit: 10 });
		assert.deepStrictEqual(result.deals, mockDeals);
		assert.strictEqual(result.count, 1);
	});

	test("passes all filters when provided", async () => {
		const prisma = setPrismaMock({
			deal: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleSearchDeals({
			query: "test",
			limit: 5,
			stage: "LEAD",
			companyId: "comp-1",
			contactId: "c1",
		});

		const callArgs = prisma.deal.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.stage, "LEAD");
		assert.strictEqual(callArgs.where.companyId, "comp-1");
		assert.strictEqual(callArgs.where.contactId, "c1");
	});
});

describe("handleCreateDeal", () => {
	test("creates deal with correct data", async () => {
		const mockDeal = {
			id: "d1",
			title: "Big Deal",
			contact: null,
			company: null,
		};
		setPrismaMock({
			deal: {
				create: mock.fn(async () => mockDeal),
			},
		});

		const result = await handleCreateDeal({ title: "Big Deal" });
		assert.deepStrictEqual(result.deal, mockDeal);
	});

	test("converts expectedCloseDate string to Date", async () => {
		const prisma = setPrismaMock({
			deal: {
				create: mock.fn(async () => ({ id: "d1" })),
			},
		});

		await handleCreateDeal({
			title: "Deal",
			expectedCloseDate: "2025-12-31T00:00:00.000Z",
		});

		const callArgs = prisma.deal.create.mock.calls[0].arguments[0];
		assert.ok(callArgs.data.expectedCloseDate instanceof Date);
	});
});

describe("handleUpdateDeal", () => {
	test("updates deal with correct data", async () => {
		const mockDeal = {
			id: "d1",
			title: "Updated Deal",
			contact: null,
			company: null,
		};
		setPrismaMock({
			deal: {
				update: mock.fn(async () => mockDeal),
			},
		});

		const result = await handleUpdateDeal({ id: "d1", title: "Updated Deal" });
		assert.deepStrictEqual(result.deal, mockDeal);
	});
});

// ── Conversation Handlers ────────────────────────────────────────────────────

describe("handleGetConversationHistory", () => {
	test("returns messages for conversation", async () => {
		const mockMessages = [
			{ id: "m1", role: "user", content: "Hello" },
			{ id: "m2", role: "assistant", content: "Hi!" },
		];
		setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => [...mockMessages].reverse()),
			},
		});

		const result = await handleGetConversationHistory({
			conversationId: "conv-1",
			limit: 20,
		});
		assert.strictEqual(result.messages.length, 2);
		assert.strictEqual(result.count, 2);
		// Messages should be reversed back to chronological order
		assert.strictEqual(result.messages[0].content, "Hello");
	});

	test("passes before filter when provided", async () => {
		const prisma = setPrismaMock({
			aiMessage: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleGetConversationHistory({
			conversationId: "conv-1",
			limit: 10,
			before: "2025-01-01T00:00:00.000Z",
		});

		const callArgs = prisma.aiMessage.findMany.mock.calls[0].arguments[0];
		assert.ok(callArgs.where.createdAt.lt instanceof Date);
	});
});

// ── Business Context Handlers ────────────────────────────────────────────────

describe("handleGetBusinessContext", () => {
	test("returns empty contexts (placeholder)", async () => {
		const result = await handleGetBusinessContext({ limit: 10 });
		assert.deepStrictEqual(result.contexts, []);
		assert.strictEqual(result.count, 0);
	});
});

describe("handleCreateBusinessContext", () => {
	test("returns created context data", async () => {
		const data = {
			key: "test.key",
			value: "test value",
			category: "client",
			source: "learned",
		};
		const result = await handleCreateBusinessContext(data);
		assert.deepStrictEqual(result.context, data);
		assert.strictEqual(result.created, true);
	});
});

// ── Job Handlers ─────────────────────────────────────────────────────────────

describe("handleSearchJobs", () => {
	test("returns jobs matching query", async () => {
		const mockJobs = [{ id: "j1", name: "send-email", status: "COMPLETED" }];
		setPrismaMock({
			job: {
				findMany: mock.fn(async () => mockJobs),
			},
		});

		const result = await handleSearchJobs({ query: "email", limit: 10 });
		assert.deepStrictEqual(result.jobs, mockJobs);
		assert.strictEqual(result.count, 1);
	});

	test("passes status and queue filters", async () => {
		const prisma = setPrismaMock({
			job: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleSearchJobs({
			query: "test",
			limit: 5,
			status: "PENDING",
			queue: "email-queue",
		});

		const callArgs = prisma.job.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.status, "PENDING");
		assert.strictEqual(callArgs.where.queue, "email-queue");
	});
});

// ── Handler Registry ─────────────────────────────────────────────────────────

describe("toolHandlers registry", () => {
	test("contains all expected handlers", () => {
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
			assert.strictEqual(
				typeof toolHandlers[name],
				"function",
				`Missing handler for ${name}`,
			);
		}
		assert.strictEqual(Object.keys(toolHandlers).length, 13);
	});
});
