import { createLogger } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";

const logger = createLogger("tools");

// ── Contact Handlers ─────────────────────────────────────────────────────────

export async function handleSearchContacts({ query, limit, companyId }) {
	const where = {
		OR: [
			{ firstName: { contains: query, mode: "insensitive" } },
			{ lastName: { contains: query, mode: "insensitive" } },
			{ email: { contains: query, mode: "insensitive" } },
		],
		...(companyId && { companyId }),
	};

	const contacts = await prisma.contact.findMany({
		where,
		take: limit,
		include: { company: true },
	});

	return { contacts, count: contacts.length };
}

export async function handleCreateContact(data) {
	const contact = await prisma.contact.create({
		data,
		include: { company: true },
	});

	logger.info("Contact created", { contactId: contact.id });
	return { contact };
}

export async function handleUpdateContact({ id, ...data }) {
	const contact = await prisma.contact.update({
		where: { id },
		data,
		include: { company: true },
	});

	logger.info("Contact updated", { contactId: contact.id });
	return { contact };
}

// ── Company Handlers ─────────────────────────────────────────────────────────

export async function handleSearchCompanies({ query, limit, industry }) {
	const where = {
		OR: [
			{ name: { contains: query, mode: "insensitive" } },
			{ website: { contains: query, mode: "insensitive" } },
		],
		...(industry && {
			industry: { equals: industry, mode: "insensitive" },
		}),
	};

	const companies = await prisma.company.findMany({
		where,
		take: limit,
		include: { _count: { select: { contacts: true, deals: true } } },
	});

	return { companies, count: companies.length };
}

export async function handleCreateCompany(data) {
	const company = await prisma.company.create({ data });
	logger.info("Company created", { companyId: company.id });
	return { company };
}

export async function handleUpdateCompany({ id, ...data }) {
	const company = await prisma.company.update({
		where: { id },
		data,
	});
	logger.info("Company updated", { companyId: company.id });
	return { company };
}

// ── Deal Handlers ────────────────────────────────────────────────────────────

export async function handleSearchDeals({
	query,
	limit,
	stage,
	companyId,
	contactId,
}) {
	const where = {
		OR: [
			{ title: { contains: query, mode: "insensitive" } },
			{ notes: { contains: query, mode: "insensitive" } },
		],
		...(stage && { stage }),
		...(companyId && { companyId }),
		...(contactId && { contactId }),
	};

	const deals = await prisma.deal.findMany({
		where,
		take: limit,
		include: { contact: true, company: true },
	});

	return { deals, count: deals.length };
}

export async function handleCreateDeal(data) {
	const dealData = {
		...data,
		expectedCloseDate: data.expectedCloseDate
			? new Date(data.expectedCloseDate)
			: undefined,
	};
	const deal = await prisma.deal.create({
		data: dealData,
		include: { contact: true, company: true },
	});
	logger.info("Deal created", { dealId: deal.id });
	return { deal };
}

export async function handleUpdateDeal({ id, ...data }) {
	const dealData = {
		...data,
		expectedCloseDate: data.expectedCloseDate
			? new Date(data.expectedCloseDate)
			: undefined,
	};
	const deal = await prisma.deal.update({
		where: { id },
		data: dealData,
		include: { contact: true, company: true },
	});
	logger.info("Deal updated", { dealId: deal.id });
	return { deal };
}

// ── Conversation Handlers ────────────────────────────────────────────────────

export async function handleGetConversationHistory({
	conversationId,
	limit,
	before,
}) {
	const where = {
		conversationId,
		...(before && { createdAt: { lt: new Date(before) } }),
	};

	const messages = await prisma.aiMessage.findMany({
		where,
		orderBy: { createdAt: "desc" },
		take: limit,
	});

	return { messages: messages.reverse(), count: messages.length };
}

// ── Context Handlers ─────────────────────────────────────────────────────────

export async function handleGetContext({ category, limit }) {
	const where = category ? { category } : {};
	const contexts = await prisma.context.findMany({
		where,
		orderBy: { updatedAt: "desc" },
		take: limit,
	});
	return { contexts, count: contexts.length };
}

export async function handleCreateContext(data) {
	const context = await prisma.context.create({ data });
	logger.info("Context created", {
		key: context.key,
		category: context.category,
	});
	return { context };
}

export async function handleUpdateContext({ id, ...data }) {
	const context = await prisma.context.update({
		where: { id },
		data,
	});
	logger.info("Context updated", { id: context.id, key: context.key });
	return { context };
}

export async function handleDeleteContext({ id }) {
	await prisma.context.delete({ where: { id } });
	logger.info("Context deleted", { id });
	return { deleted: true };
}

export async function handleSearchContext({ query, category, limit }) {
	const where = {
		OR: [
			{ key: { contains: query, mode: "insensitive" } },
			{ value: { contains: query, mode: "insensitive" } },
		],
		...(category && { category }),
	};
	const contexts = await prisma.context.findMany({
		where,
		orderBy: { updatedAt: "desc" },
		take: limit,
	});
	return { contexts, count: contexts.length };
}

// ── Job Handlers ─────────────────────────────────────────────────────────────

export async function handleSearchJobs({ query, limit, status, queue }) {
	const where = {
		OR: [{ name: { contains: query, mode: "insensitive" } }],
		...(status && { status }),
		...(queue && { queue }),
	};

	const jobs = await prisma.job.findMany({
		where,
		orderBy: { createdAt: "desc" },
		take: limit,
	});

	return { jobs, count: jobs.length };
}

// ── Web Search Handlers ───────────────────────────────────────────────────────

const SEARCH_PROVIDERS = {
	brave: async (query, maxResults, apiKey) => {
		const url = new URL("https://api.search.brave.com/res/v1/web/search");
		url.searchParams.set("q", query);
		url.searchParams.set("count", String(maxResults));
		const res = await fetch(url, {
			headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) throw new Error(`Brave search failed: ${res.status}`);
		const data = await res.json();
		return (data.web?.results || []).map((r) => ({
			title: r.title,
			url: r.url,
			snippet: r.description,
		}));
	},
};

export async function handleWebSearch({ query, maxResults }) {
	const apiKey = process.env.SEARCH_API_KEY;
	if (!apiKey) {
		return {
			results: [],
			notice: "Web search is not configured — set SEARCH_API_KEY",
		};
	}

	const provider = process.env.SEARCH_PROVIDER || "brave";
	const searchFn = SEARCH_PROVIDERS[provider];

	if (!searchFn) {
		return { results: [], notice: `Unknown search provider: ${provider}` };
	}

	try {
		const results = await searchFn(query, maxResults, apiKey);
		logger.info("Web search completed", {
			provider,
			query,
			resultCount: results.length,
		});
		return { results };
	} catch (error) {
		logger.error("Web search failed", {
			provider,
			query,
			error: error.message,
		});
		return { results: [], error: `Search failed: ${error.message}` };
	}
}

// ── Handler Registry ─────────────────────────────────────────────────────────

export const toolHandlers = {
	search_contacts: handleSearchContacts,
	create_contact: handleCreateContact,
	update_contact: handleUpdateContact,
	search_companies: handleSearchCompanies,
	create_company: handleCreateCompany,
	update_company: handleUpdateCompany,
	search_deals: handleSearchDeals,
	create_deal: handleCreateDeal,
	update_deal: handleUpdateDeal,
	get_conversation_history: handleGetConversationHistory,

	// Context tools (replaces business context placeholders)
	get_context: handleGetContext,
	create_context: handleCreateContext,
	update_context: handleUpdateContext,
	delete_context: handleDeleteContext,
	search_context: handleSearchContext,

	search_jobs: handleSearchJobs,

	web_search: handleWebSearch,
};
