import { z } from "zod";
import { crmConfig } from "./config.js";

/** @returns {[string, ...string[]]} Current stage keys from config */
function getStageKeys() {
	const keys = crmConfig.pipelineStages.map((s) => s.key);
	if (keys.length === 0) return ["LEAD"];
	return /** @type {[string, ...string[]]} */ (keys);
}

export const contactSchema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	email: z.string().email().optional().or(z.literal("")),
	phone: z.string().optional().or(z.literal("")),
	position: z.string().optional().or(z.literal("")),
	notes: z.string().optional().or(z.literal("")),
	companyId: z.string().optional().or(z.literal("")),
});

export const companySchema = z.object({
	name: z.string().min(1, "Company name is required"),
	website: z.string().optional().or(z.literal("")),
	industry: z.string().optional().or(z.literal("")),
	size: z.string().optional().or(z.literal("")),
	notes: z.string().optional().or(z.literal("")),
});

/** Deal schema — stage validation reads from crmConfig at parse time */
export const dealSchema = z.object({
	title: z.string().min(1, "Deal title is required"),
	value: z.coerce.number().min(0).default(0),
	stage: z
		.string()
		.default("LEAD")
		.refine((val) => getStageKeys().includes(val), {
			message: "Invalid stage for current pipeline configuration",
		}),
	probability: z.coerce.number().int().min(0).max(100).default(10),
	expectedCloseDate: z
		.string()
		.optional()
		.transform((v) => (v ? v : undefined)),
	notes: z.string().optional().or(z.literal("")),
	contactId: z.string().optional().or(z.literal("")),
	companyId: z.string().optional().or(z.literal("")),
});
