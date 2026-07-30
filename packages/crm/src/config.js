import { prisma } from "@techstream/quark-db";

const CONFIG_KEY = "crm";

/**
 * Hardcoded defaults — used as fallback when no DB row exists,
 * and as seed values when creating the first config row.
 */
export const DEFAULT_CRM_CONFIG = {
	entityLabel: "Deal",
	entityPluralLabel: "Deals",
	containerLabel: "Company",
	containerPluralLabel: "Companies",
	actorLabel: "Contact",
	actorPluralLabel: "Contacts",

	pipelineStages: [
		{
			key: "LEAD",
			label: "Lead",
			color: "default",
			probability: 10,
			next: ["QUALIFIED"],
		},
		{
			key: "QUALIFIED",
			label: "Qualified",
			color: "info",
			probability: 25,
			next: ["PROPOSAL", "LEAD"],
		},
		{
			key: "PROPOSAL",
			label: "Proposal",
			color: "primary",
			probability: 50,
			next: ["NEGOTIATION", "QUALIFIED"],
		},
		{
			key: "NEGOTIATION",
			label: "Negotiation",
			color: "warning",
			probability: 75,
			next: ["CLOSED_WON", "CLOSED_LOST", "PROPOSAL"],
		},
		{
			key: "CLOSED_WON",
			label: "Closed Won",
			color: "success",
			probability: 100,
			next: [],
		},
		{
			key: "CLOSED_LOST",
			label: "Closed Lost",
			color: "danger",
			probability: 0,
			next: [],
		},
	],

	currency: "USD",
	locale: "en-US",
	defaultPageSize: 25,

	fields: {
		entity: [
			{ key: "title", type: "text", required: true },
			{ key: "value", type: "number", required: true, min: 0, step: "0.01" },
			{
				key: "probability",
				type: "number",
				required: true,
				min: 0,
				max: 100,
			},
			{ key: "stage", type: "select", required: true },
			{ key: "expectedCloseDate", type: "date" },
			{ key: "contactId", type: "select", relation: "actor" },
			{ key: "companyId", type: "select", relation: "container" },
			{ key: "notes", type: "textarea" },
		],
		actor: [
			{ key: "firstName", type: "text", required: true },
			{ key: "lastName", type: "text", required: true },
			{ key: "email", type: "email" },
			{ key: "phone", type: "text" },
			{ key: "position", type: "text" },
			{ key: "companyId", type: "select", relation: "container" },
			{ key: "notes", type: "textarea" },
		],
		container: [
			{ key: "name", type: "text", required: true },
			{ key: "website", type: "text" },
			{ key: "industry", type: "text" },
			{ key: "size", type: "text" },
			{ key: "notes", type: "textarea" },
		],
	},
};

/**
 * Load CRM config from AppConfig (key = "crm").
 * Falls back to hardcoded defaults when no row exists.
 * @returns {Promise<typeof DEFAULT_CRM_CONFIG>}
 */
export async function getCrmConfig() {
	const row = await prisma.appConfig.findUnique({
		where: { key: CONFIG_KEY },
	});
	if (!row?.value || typeof row.value !== "object") {
		return structuredClone(DEFAULT_CRM_CONFIG);
	}
	return {
		...structuredClone(DEFAULT_CRM_CONFIG),
		...row.value,
		fields: {
			...DEFAULT_CRM_CONFIG.fields,
			...(row.value.fields ?? {}),
		},
	};
}

/**
 * Upsert CRM config under AppConfig key "crm".
 * Merges partial updates with the current config.
 * @param {Partial<typeof DEFAULT_CRM_CONFIG> & Record<string, unknown>} data
 * @returns {Promise<typeof DEFAULT_CRM_CONFIG>}
 */
export async function updateCrmConfig(data) {
	const current = await getCrmConfig();
	const next = {
		...current,
		...data,
		fields: data.fields
			? {
					...current.fields,
					...data.fields,
				}
			: current.fields,
	};

	const row = await prisma.appConfig.upsert({
		where: { key: CONFIG_KEY },
		update: { value: next },
		create: { key: CONFIG_KEY, value: next },
	});

	return row.value;
}

/**
 * Format a monetary value using locale/currency from options or defaults.
 * @param {number|string} value
 * @param {{ maximumFractionDigits?: number, locale?: string, currency?: string }} [options]
 * @returns {string}
 */
export function formatCurrency(value, options = {}) {
	const {
		maximumFractionDigits = 0,
		locale = DEFAULT_CRM_CONFIG.locale,
		currency = DEFAULT_CRM_CONFIG.currency,
	} = options;
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		maximumFractionDigits,
	}).format(Number(value));
}
