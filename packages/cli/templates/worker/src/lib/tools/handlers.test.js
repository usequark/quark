import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
	handleCreateCompany,
	handleCreateContact,
	handleCreateContext,
	handleCreateDeal,
	handleDeleteContext,
	handleGetContext,
	handleGetConversationHistory,
	handleSearchCompanies,
	handleSearchContacts,
	handleSearchContext,
	handleSearchDeals,
	handleSearchJobs,
	handleUpdateCompany,
	handleUpdateContact,
	handleUpdateContext,
	handleUpdateDeal,
	handleWebSearch,
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

// ── Context Handlers ─────────────────────────────────────────────────────────

describe("handleGetContext", () => {
	test("returns contexts from DB", async () => {
		const mockContexts = [
			{
				id: "ctx-1",
				key: "client.acme",
				value: "Acme Corp",
				category: "client",
			},
		];
		const prisma = setPrismaMock({
			context: {
				findMany: mock.fn(async () => mockContexts),
			},
		});

		const result = await handleGetContext({ limit: 10 });
		assert.deepStrictEqual(result.contexts, mockContexts);
		assert.strictEqual(result.count, 1);
		assert.strictEqual(prisma.context.findMany.mock.callCount(), 1);
	});

	test("passes category filter when provided", async () => {
		const prisma = setPrismaMock({
			context: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleGetContext({ category: "client", limit: 10 });
		const callArgs = prisma.context.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.category, "client");
	});

	test("omits category filter when not provided", async () => {
		const prisma = setPrismaMock({
			context: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleGetContext({ limit: 10 });
		const callArgs = prisma.context.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.category, undefined);
	});
});

describe("handleCreateContext", () => {
	test("creates context record", async () => {
		const mockContext = {
			id: "ctx-1",
			key: "client.acme",
			value: "Acme Corp",
			category: "client",
			source: "ai",
		};
		const prisma = setPrismaMock({
			context: {
				create: mock.fn(async () => mockContext),
			},
		});

		const result = await handleCreateContext({
			key: "client.acme",
			value: "Acme Corp",
			category: "client",
			source: "ai",
		});
		assert.deepStrictEqual(result.context, mockContext);
		assert.strictEqual(prisma.context.create.mock.callCount(), 1);
	});
});

describe("handleUpdateContext", () => {
	test("updates context record", async () => {
		const mockContext = {
			id: "ctx-1",
			key: "client.acme",
			value: "Updated value",
		};
		const prisma = setPrismaMock({
			context: {
				update: mock.fn(async () => mockContext),
			},
		});

		const result = await handleUpdateContext({
			id: "ctx-1",
			value: "Updated value",
		});
		assert.deepStrictEqual(result.context, mockContext);
		const callArgs = prisma.context.update.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.id, "ctx-1");
		assert.strictEqual(callArgs.data.value, "Updated value");
	});
});

describe("handleDeleteContext", () => {
	test("deletes context record", async () => {
		const prisma = setPrismaMock({
			context: {
				delete: mock.fn(async () => ({ id: "ctx-1" })),
			},
		});

		const result = await handleDeleteContext({ id: "ctx-1" });
		assert.strictEqual(result.deleted, true);
		assert.strictEqual(prisma.context.delete.mock.callCount(), 1);
		const callArgs = prisma.context.delete.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.id, "ctx-1");
	});
});

describe("handleSearchContext", () => {
	test("searches contexts by key or value", async () => {
		const mockContexts = [
			{
				id: "ctx-1",
				key: "client.acme",
				value: "Acme Corp",
				category: "client",
			},
		];
		const prisma = setPrismaMock({
			context: {
				findMany: mock.fn(async () => mockContexts),
			},
		});

		const result = await handleSearchContext({ query: "acme", limit: 10 });
		assert.deepStrictEqual(result.contexts, mockContexts);
		assert.strictEqual(result.count, 1);
	});

	test("passes OR filter for key and value", async () => {
		const prisma = setPrismaMock({
			context: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleSearchContext({ query: "acme", limit: 10 });
		const callArgs = prisma.context.findMany.mock.calls[0].arguments[0];
		assert.ok(callArgs.where.OR);
		assert.strictEqual(callArgs.where.OR.length, 2);
	});

	test("passes category filter when provided", async () => {
		const prisma = setPrismaMock({
			context: {
				findMany: mock.fn(async () => []),
			},
		});

		await handleSearchContext({ query: "acme", category: "client", limit: 10 });
		const callArgs = prisma.context.findMany.mock.calls[0].arguments[0];
		assert.strictEqual(callArgs.where.category, "client");
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

// ── Web Search Handlers ──────────────────────────────────────────────────────

describe("handleWebSearch", () => {
	test("returns notice when SEARCH_API_KEY is not set", async () => {
		const origKey = process.env.SEARCH_API_KEY;
		delete process.env.SEARCH_API_KEY;

		try {
			const result = await handleWebSearch({ query: "test", maxResults: 5 });
			assert.deepStrictEqual(result.results, []);
			assert.ok(result.notice.includes("not configured"));
		} finally {
			if (origKey !== undefined) {
				process.env.SEARCH_API_KEY = origKey;
			}
		}
	});

	test("returns results from Brave search", async () => {
		const origKey = process.env.SEARCH_API_KEY;
		const origFetch = globalThis.fetch;
		process.env.SEARCH_API_KEY = "test-key";

		const mockResults = [
			{
				title: "Result 1",
				url: "https://example.com/1",
				description: "First result",
			},
			{
				title: "Result 2",
				url: "https://example.com/2",
				description: "Second result",
			},
		];

		globalThis.fetch = mock.fn(async () => ({
			ok: true,
			json: async () => ({ web: { results: mockResults } }),
		}));

		try {
			const result = await handleWebSearch({
				query: "test query",
				maxResults: 2,
			});
			assert.strictEqual(result.results.length, 2);
			assert.strictEqual(result.results[0].title, "Result 1");
			assert.strictEqual(result.results[0].url, "https://example.com/1");
			assert.strictEqual(result.results[0].snippet, "First result");
			assert.strictEqual(result.results[1].title, "Result 2");

			const callArgs = globalThis.fetch.mock.calls[0].arguments;
			assert.ok(callArgs[0] instanceof URL || typeof callArgs[0] === "string");
			const url = callArgs[0] instanceof URL ? callArgs[0].href : callArgs[0];
			assert.ok(url.includes("api.search.brave.com"));
			assert.ok(url.includes("q=test+query"));
			assert.strictEqual(
				callArgs[1].headers["X-Subscription-Token"],
				"test-key",
			);
		} finally {
			globalThis.fetch = origFetch;
			if (origKey !== undefined) {
				process.env.SEARCH_API_KEY = origKey;
			} else {
				delete process.env.SEARCH_API_KEY;
			}
		}
	});

	test("returns error on search failure", async () => {
		const origKey = process.env.SEARCH_API_KEY;
		const origFetch = globalThis.fetch;
		process.env.SEARCH_API_KEY = "test-key";

		globalThis.fetch = mock.fn(async () => ({
			ok: false,
			status: 429,
		}));

		try {
			const result = await handleWebSearch({ query: "test", maxResults: 5 });
			assert.deepStrictEqual(result.results, []);
			assert.ok(result.error.includes("Search failed"));
		} finally {
			globalThis.fetch = origFetch;
			if (origKey !== undefined) {
				process.env.SEARCH_API_KEY = origKey;
			} else {
				delete process.env.SEARCH_API_KEY;
			}
		}
	});

	test("returns notice for unknown provider", async () => {
		const origKey = process.env.SEARCH_API_KEY;
		const origProvider = process.env.SEARCH_PROVIDER;
		process.env.SEARCH_API_KEY = "test-key";
		process.env.SEARCH_PROVIDER = "nonexistent";

		try {
			const result = await handleWebSearch({ query: "test", maxResults: 5 });
			assert.deepStrictEqual(result.results, []);
			assert.ok(result.notice.includes("Unknown search provider"));
		} finally {
			if (origKey !== undefined) {
				process.env.SEARCH_API_KEY = origKey;
			} else {
				delete process.env.SEARCH_API_KEY;
			}
			if (origProvider !== undefined) {
				process.env.SEARCH_PROVIDER = origProvider;
			} else {
				delete process.env.SEARCH_PROVIDER;
			}
		}
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
			"get_context",
			"create_context",
			"update_context",
			"delete_context",
			"search_context",
			"search_jobs",
			"web_search",
		];

		for (const name of expectedTools) {
			assert.strictEqual(
				typeof toolHandlers[name],
				"function",
				`Missing handler for ${name}`,
			);
		}
		assert.strictEqual(Object.keys(toolHandlers).length, 17);
	});
});
