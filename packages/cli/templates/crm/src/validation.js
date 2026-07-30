import { z } from "zod";
import { DEFAULT_CRM_CONFIG } from "./config.js";

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

/**
 * @param {typeof DEFAULT_CRM_CONFIG} config
 * @returns {[string, ...string[]]}
 */
function getStageKeys(config) {
	const keys = (config.pipelineStages ?? []).map((s) => s.key);
	if (keys.length === 0) return ["LEAD"];
	return /** @type {[string, ...string[]]} */ (keys);
}

/**
 * @param {typeof DEFAULT_CRM_CONFIG} config
 * @returns {string}
 */
function getDefaultStageKey(config) {
	return config.pipelineStages?.[0]?.key ?? "LEAD";
}

/**
 * Build a Zod schema field from a CRM field definition.
 * @param {object} field
 * @param {typeof DEFAULT_CRM_CONFIG} config
 * @returns {z.ZodTypeAny}
 */
function fieldToZod(field, config) {
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
				const stageKeys = getStageKeys(config);
				const defaultKey = getDefaultStageKey(config);
				return z
					.string()
					.default(defaultKey)
					.refine((val) => stageKeys.includes(val), {
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
 * @param {typeof DEFAULT_CRM_CONFIG} [config]
 * @returns {z.ZodObject<any>}
 */
export function generateSchema(fields, config = DEFAULT_CRM_CONFIG) {
	/** @type {Record<string, z.ZodTypeAny>} */
	const shape = {};
	for (const field of fields) {
		if (!field?.key) continue;
		shape[field.key] = fieldToZod(field, config);
	}
	return z.object(shape);
}

/** Contact/actor schema — generated from default config fields.actor */
export const contactSchema = generateSchema(
	DEFAULT_CRM_CONFIG.fields.actor,
	DEFAULT_CRM_CONFIG,
);

/** Company/container schema — generated from default config fields.container */
export const companySchema = generateSchema(
	DEFAULT_CRM_CONFIG.fields.container,
	DEFAULT_CRM_CONFIG,
);

/** Deal/entity schema — generated from default config fields.entity */
export const dealSchema = generateSchema(
	DEFAULT_CRM_CONFIG.fields.entity,
	DEFAULT_CRM_CONFIG,
);

/**
 * Build schemas from a live config object (e.g. DB-backed).
 * @param {typeof DEFAULT_CRM_CONFIG} config
 */
export function schemasFromConfig(config) {
	return {
		contact: generateSchema(config.fields.actor, config),
		company: generateSchema(config.fields.container, config),
		deal: generateSchema(config.fields.entity, config),
	};
}
