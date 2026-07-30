/**
 * Base CRM config — minimal mouldable pipeline scaffold.
 * Override labels, stages, and fields to fit any system.
 */
export const crmConfig = {
	// Entity labels — what to call things
	entityLabel: "Deal",
	entityPluralLabel: "Deals",
	containerLabel: "Company",
	containerPluralLabel: "Companies",
	actorLabel: "Contact",
	actorPluralLabel: "Contacts",

	// Pipeline stages — fully user-defined
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

	// Currency/locale for formatting
	currency: "USD",
	locale: "en-US",

	// Default page size
	defaultPageSize: 25,

	// Field definitions — schema reflections, not opinions.
	// Labels are derived from keys. Override with `label` if needed.
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
 * Format a monetary value using crmConfig locale/currency.
 * @param {number|string} value
 * @param {{ maximumFractionDigits?: number }} [options]
 * @returns {string}
 */
export function formatCurrency(value, options = {}) {
	const { maximumFractionDigits = 0 } = options;
	return new Intl.NumberFormat(crmConfig.locale, {
		style: "currency",
		currency: crmConfig.currency,
		maximumFractionDigits,
	}).format(Number(value));
}
