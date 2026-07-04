import { z } from "zod";

// ── Tool Schemas ─────────────────────────────────────────────────────────────

export const searchContactsSchema = z.object({
	query: z.string().min(1, "Search query is required"),
	limit: z.number().int().positive().max(50).optional().default(10),
	companyId: z.string().optional(),
});

export const createContactSchema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	email: z.string().email("Invalid email").optional(),
	phone: z.string().optional(),
	position: z.string().optional(),
	companyId: z.string().optional(),
	notes: z.string().optional(),
});

export const updateContactSchema = z.object({
	id: z.string().min(1, "Contact ID is required"),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	email: z.string().email("Invalid email").optional(),
	phone: z.string().optional(),
	position: z.string().optional(),
	companyId: z.string().nullable().optional(),
	notes: z.string().optional(),
});

export const searchCompaniesSchema = z.object({
	query: z.string().min(1, "Search query is required"),
	limit: z.number().int().positive().max(50).optional().default(10),
	industry: z.string().optional(),
});

export const createCompanySchema = z.object({
	name: z.string().min(1, "Company name is required"),
	website: z.string().url("Invalid URL").optional(),
	industry: z.string().optional(),
	size: z.string().optional(),
	notes: z.string().optional(),
});

export const updateCompanySchema = z.object({
	id: z.string().min(1, "Company ID is required"),
	name: z.string().optional(),
	website: z.string().url("Invalid URL").optional().nullable(),
	industry: z.string().optional().nullable(),
	size: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
});

export const searchDealsSchema = z.object({
	query: z.string().min(1, "Search query is required"),
	limit: z.number().int().positive().max(50).optional().default(10),
	stage: z
		.enum([
			"LEAD",
			"QUALIFIED",
			"PROPOSAL",
			"NEGOTIATION",
			"CLOSED_WON",
			"CLOSED_LOST",
		])
		.optional(),
	companyId: z.string().optional(),
	contactId: z.string().optional(),
});

export const createDealSchema = z.object({
	title: z.string().min(1, "Deal title is required"),
	value: z.number().min(0).optional().default(0),
	stage: z
		.enum([
			"LEAD",
			"QUALIFIED",
			"PROPOSAL",
			"NEGOTIATION",
			"CLOSED_WON",
			"CLOSED_LOST",
		])
		.optional()
		.default("LEAD"),
	probability: z.number().int().min(0).max(100).optional().default(10),
	expectedCloseDate: z.string().datetime().optional(),
	contactId: z.string().optional(),
	companyId: z.string().optional(),
	notes: z.string().optional(),
});

export const updateDealSchema = z.object({
	id: z.string().min(1, "Deal ID is required"),
	title: z.string().optional(),
	value: z.number().min(0).optional(),
	stage: z
		.enum([
			"LEAD",
			"QUALIFIED",
			"PROPOSAL",
			"NEGOTIATION",
			"CLOSED_WON",
			"CLOSED_LOST",
		])
		.optional(),
	probability: z.number().int().min(0).max(100).optional(),
	expectedCloseDate: z.string().datetime().optional().nullable(),
	contactId: z.string().optional().nullable(),
	companyId: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
});

export const getConversationHistorySchema = z.object({
	conversationId: z.string().min(1, "Conversation ID is required"),
	limit: z.number().int().positive().max(100).optional().default(20),
	before: z.string().datetime().optional(),
});

export const getBusinessContextSchema = z.object({
	category: z
		.enum(["billing", "client", "task", "tech_note", "process", "preference"])
		.optional(),
	limit: z.number().int().positive().max(50).optional().default(10),
});

export const createBusinessContextSchema = z.object({
	key: z.string().min(1, "Key is required"),
	value: z.string().min(1, "Value is required"),
	category: z.enum([
		"billing",
		"client",
		"task",
		"tech_note",
		"process",
		"preference",
	]),
	source: z.enum(["seed", "learned"]).optional().default("learned"),
});

export const searchJobsSchema = z.object({
	query: z.string().min(1, "Search query is required"),
	limit: z.number().int().positive().max(50).optional().default(10),
	status: z
		.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"])
		.optional(),
	queue: z.string().optional(),
});

// ── Schema Registry ──────────────────────────────────────────────────────────

export const toolSchemas = {
	search_contacts: searchContactsSchema,
	create_contact: createContactSchema,
	update_contact: updateContactSchema,
	search_companies: searchCompaniesSchema,
	create_company: createCompanySchema,
	update_company: updateCompanySchema,
	search_deals: searchDealsSchema,
	create_deal: createDealSchema,
	update_deal: updateDealSchema,
	get_conversation_history: getConversationHistorySchema,
	get_business_context: getBusinessContextSchema,
	create_business_context: createBusinessContextSchema,
	search_jobs: searchJobsSchema,
};
