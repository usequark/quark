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

// ── Business Context Handlers ────────────────────────────────────────────────

export async function handleGetBusinessContext({ category, limit }) {
	// This is a placeholder — in production, this would query a BusinessContext model
	// For now, return empty array
	return { contexts: [], count: 0 };
}

export async function handleCreateBusinessContext(data) {
	// This is a placeholder — in production, this would create a BusinessContext record
	logger.info("Business context created", {
		key: data.key,
		category: data.category,
	});
	return { context: data, created: true };
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
	get_business_context: handleGetBusinessContext,
	create_business_context: handleCreateBusinessContext,
	search_jobs: handleSearchJobs,
};
