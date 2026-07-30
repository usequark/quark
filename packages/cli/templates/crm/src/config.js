import { prisma } from "@techstream/quark-db";
import { cache } from "react";

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
 * Map a Prisma CrmConfig row to the app-facing config shape.
 * @param {object} row
 * @returns {typeof DEFAULT_CRM_CONFIG & { id?: string }}
 */
export function mapRowToConfig(row) {
	return {
		id: row.id,
		entityLabel: row.entityLabel,
		entityPluralLabel: row.entityPlural,
		containerLabel: row.containerLabel,
		containerPluralLabel: row.containerPlural,
		actorLabel: row.actorLabel,
		actorPluralLabel: row.actorPlural,
		pipelineStages: Array.isArray(row.pipelineStages)
			? row.pipelineStages
			: DEFAULT_CRM_CONFIG.pipelineStages,
		currency: row.currency,
		locale: row.locale,
		defaultPageSize: row.defaultPageSize,
		fields:
			row.fields && typeof row.fields === "object"
				? row.fields
				: DEFAULT_CRM_CONFIG.fields,
	};
}

/**
 * Map app-facing config (or partial update) to Prisma create/update data.
 * @param {Partial<typeof DEFAULT_CRM_CONFIG> & Record<string, unknown>} data
 * @returns {object}
 */
export function mapConfigToRow(data) {
	/** @type {Record<string, unknown>} */
	const row = {};

	if (data.entityLabel !== undefined) row.entityLabel = data.entityLabel;
	if (data.entityPluralLabel !== undefined)
		row.entityPlural = data.entityPluralLabel;
	if (data.entityPlural !== undefined) row.entityPlural = data.entityPlural;
	if (data.containerLabel !== undefined)
		row.containerLabel = data.containerLabel;
	if (data.containerPluralLabel !== undefined)
		row.containerPlural = data.containerPluralLabel;
	if (data.containerPlural !== undefined)
		row.containerPlural = data.containerPlural;
	if (data.actorLabel !== undefined) row.actorLabel = data.actorLabel;
	if (data.actorPluralLabel !== undefined)
		row.actorPlural = data.actorPluralLabel;
	if (data.actorPlural !== undefined) row.actorPlural = data.actorPlural;
	if (data.pipelineStages !== undefined)
		row.pipelineStages = data.pipelineStages;
	if (data.currency !== undefined) row.currency = data.currency;
	if (data.locale !== undefined) row.locale = data.locale;
	if (data.defaultPageSize !== undefined)
		row.defaultPageSize = data.defaultPageSize;
	if (data.fields !== undefined) row.fields = data.fields;

	return row;
}

/**
 * Load CRM config from DB via the given Prisma client.
 * Falls back to hardcoded defaults when no row exists or DB is unavailable.
 * @param {object} [db] Prisma client (defaults to shared singleton)
 * @returns {Promise<typeof DEFAULT_CRM_CONFIG & { id?: string }>}
 */
export async function loadCrmConfig(db = prisma) {
	try {
		const row = await db.crmConfig.findFirst({
			orderBy: { createdAt: "asc" },
		});
		if (!row) {
			return structuredClone(DEFAULT_CRM_CONFIG);
		}
		return mapRowToConfig(row);
	} catch {
		return structuredClone(DEFAULT_CRM_CONFIG);
	}
}

/**
 * Per-request deduped CRM config loader (React cache).
 * @returns {Promise<typeof DEFAULT_CRM_CONFIG & { id?: string }>}
 */
export const getCrmConfig = cache(async () => loadCrmConfig(prisma));

/**
 * Upsert the single global CRM config row.
 * @param {Partial<typeof DEFAULT_CRM_CONFIG> & Record<string, unknown>} data
 * @param {object} [db] Prisma client
 * @returns {Promise<typeof DEFAULT_CRM_CONFIG & { id?: string }>}
 */
export async function updateCrmConfig(data, db = prisma) {
	const existing = await db.crmConfig.findFirst({
		orderBy: { createdAt: "asc" },
	});

	const rowData = mapConfigToRow(data);

	if (existing) {
		const updated = await db.crmConfig.update({
			where: { id: existing.id },
			data: rowData,
		});
		return mapRowToConfig(updated);
	}

	const created = await db.crmConfig.create({
		data: {
			entityLabel: DEFAULT_CRM_CONFIG.entityLabel,
			entityPlural: DEFAULT_CRM_CONFIG.entityPluralLabel,
			containerLabel: DEFAULT_CRM_CONFIG.containerLabel,
			containerPlural: DEFAULT_CRM_CONFIG.containerPluralLabel,
			actorLabel: DEFAULT_CRM_CONFIG.actorLabel,
			actorPlural: DEFAULT_CRM_CONFIG.actorPluralLabel,
			pipelineStages: DEFAULT_CRM_CONFIG.pipelineStages,
			currency: DEFAULT_CRM_CONFIG.currency,
			locale: DEFAULT_CRM_CONFIG.locale,
			defaultPageSize: DEFAULT_CRM_CONFIG.defaultPageSize,
			fields: DEFAULT_CRM_CONFIG.fields,
			...rowData,
		},
	});
	return mapRowToConfig(created);
}

/**
 * Ensure a CrmConfig row exists, creating one from defaults if missing.
 * @param {object} [db]
 * @returns {Promise<typeof DEFAULT_CRM_CONFIG & { id?: string }>}
 */
export async function ensureCrmConfig(db = prisma) {
	const existing = await db.crmConfig.findFirst({
		orderBy: { createdAt: "asc" },
	});
	if (existing) return mapRowToConfig(existing);

	const created = await db.crmConfig.create({
		data: {
			entityLabel: DEFAULT_CRM_CONFIG.entityLabel,
			entityPlural: DEFAULT_CRM_CONFIG.entityPluralLabel,
			containerLabel: DEFAULT_CRM_CONFIG.containerLabel,
			containerPlural: DEFAULT_CRM_CONFIG.containerPluralLabel,
			actorLabel: DEFAULT_CRM_CONFIG.actorLabel,
			actorPlural: DEFAULT_CRM_CONFIG.actorPluralLabel,
			pipelineStages: DEFAULT_CRM_CONFIG.pipelineStages,
			currency: DEFAULT_CRM_CONFIG.currency,
			locale: DEFAULT_CRM_CONFIG.locale,
			defaultPageSize: DEFAULT_CRM_CONFIG.defaultPageSize,
			fields: DEFAULT_CRM_CONFIG.fields,
		},
	});
	return mapRowToConfig(created);
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
