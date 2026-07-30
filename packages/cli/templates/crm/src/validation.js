import { z } from "zod";
import { crmConfig } from "./config.js";

/**
 * Derive a human-readable label from a camelCase field key.
 * e.g. "firstName" → "First Name", "expectedCloseDate" → "Expected Close Date"
 * @param {string} key
 * @returns {string}
 */
function humanize(key) {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (s) => s.toUpperCase())
		.replace(/Id$/, "")
		.trim();
}

/** @returns {[string, ...string[]]} Current stage keys from config */
function getStageKeys() {
	const keys = crmConfig.pipelineStages.map((s) => s.key);
	if (keys.length === 0) return ["LEAD"];
	return /** @type {[string, ...string[]]} */ (keys);
}

/** @returns {string} Default stage key (first pipeline stage) */
function getDefaultStageKey() {
	return crmConfig.pipelineStages[0]?.key ?? "LEAD";
}

/**
 * Build a Zod schema field from a CRM field definition.
 * @param {object} field
 * @returns {z.ZodTypeAny}
 */
function fieldToZod(field) {
	const label = field.label ?? humanize(field.key);

	switch (field.type) {
		case "email": {
			return z.string().email().optional().or(z.literal(""));
		}

		case "number": {
			let schema = z.coerce.number();
			if (field.integer) {
				schema = schema.int();
			}
			if (typeof field.min === "number") {
				schema = schema.min(field.min);
			}
			if (typeof field.max === "number") {
				schema = schema.max(field.max);
			}
			if (field.default !== undefined) {
				schema = schema.default(field.default);
			}
			return schema;
		}

		case "date": {
			return z
				.string()
				.optional()
				.transform((v) => (v ? v : undefined));
		}

		case "select": {
			if (field.key === "stage") {
				return z
					.string()
					.default(getDefaultStageKey())
					.refine((val) => getStageKeys().includes(val), {
						message: "Invalid stage for current pipeline configuration",
					});
			}
			// Relation / plain selects — optional id strings
			return z.string().optional().or(z.literal(""));
		}

		default: {
			// text, textarea, and unknown string-like types
			if (field.required) {
				return z
					.string({ message: `${label} is required` })
					.min(1, `${label} is required`);
			}
			return z.string().optional().or(z.literal(""));
		}
	}
}

/**
 * Generate a Zod object schema from CRM field definitions.
 * @param {Array<object>} fields
 * @returns {z.ZodObject<any>}
 */
export function generateSchema(fields) {
	/** @type {Record<string, z.ZodTypeAny>} */
	const shape = {};
	for (const field of fields) {
		if (!field?.key) continue;
		shape[field.key] = fieldToZod(field);
	}
	return z.object(shape);
}

/** Contact/actor schema — generated from crmConfig.fields.actor */
export const contactSchema = generateSchema(crmConfig.fields.actor);

/** Company/container schema — generated from crmConfig.fields.container */
export const companySchema = generateSchema(crmConfig.fields.container);

/** Deal/entity schema — generated from crmConfig.fields.entity */
export const dealSchema = generateSchema(crmConfig.fields.entity);
