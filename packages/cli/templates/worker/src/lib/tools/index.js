import { toolHandlers } from "./handlers.js";
import { toolSchemas } from "./schemas.js";

/**
 * Get all registered tool names.
 * @returns {string[]}
 */
export function getToolNames() {
	return Object.keys(toolSchemas);
}

/**
 * Get tool definition (schema + name) for OpenRouter function calling.
 * @param {string} name
 * @returns {Object}
 */
export function getToolDefinition(name) {
	const schema = toolSchemas[name];
	if (!schema) {
		throw new Error(`Unknown tool: ${name}`);
	}

	return {
		type: "function",
		function: {
			name,
			description: getToolDescription(name),
			parameters: zodToJsonSchema(schema),
		},
	};
}

/**
 * Get all tool definitions for OpenRouter function calling.
 * @returns {Object[]}
 */
export function getAllToolDefinitions() {
	return getToolNames().map((name) => getToolDefinition(name));
}

/**
 * Get the handler function for a tool.
 * @param {string} name
 * @returns {Function}
 */
export function getToolHandler(name) {
	const handler = toolHandlers[name];
	if (!handler) {
		throw new Error(`No handler for tool: ${name}`);
	}
	return handler;
}

/**
 * Execute a tool with validated input.
 * @param {string} name
 * @param {Object} input
 * @returns {Promise<Object>}
 */
export async function executeTool(name, input) {
	const schema = toolSchemas[name];
	if (!schema) {
		throw new Error(`Unknown tool: ${name}`);
	}

	const validated = schema.parse(input);
	const handler = getToolHandler(name);
	return handler(validated);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToolDescription(name) {
	const descriptions = {
		search_contacts: "Search contacts by name, email, or company",
		create_contact: "Create a new contact in the CRM",
		update_contact: "Update an existing contact's information",
		search_companies: "Search companies by name, website, or industry",
		create_company: "Create a new company record",
		update_company: "Update an existing company's information",
		search_deals: "Search deals by title, stage, company, or contact",
		create_deal: "Create a new deal in the sales pipeline",
		update_deal: "Update an existing deal's information",
		get_conversation_history: "Retrieve conversation message history",
		get_business_context: "Retrieve business context records",
		create_business_context: "Create a new business context record",
		search_jobs: "Search background jobs by name, status, or queue",
	};
	return descriptions[name] || `Execute ${name} tool`;
}

/**
 * Convert a Zod schema to JSON Schema format.
 * Simple implementation that handles the schemas we use.
 */
function zodToJsonSchema(schema) {
	const shape = schema.shape;
	const properties = {};
	const required = [];

	for (const [key, zodType] of Object.entries(shape)) {
		const def = zodType._def;
		const prop = {};

		if (def.typeName === "ZodString") {
			prop.type = "string";
			if (def.checks) {
				for (const check of def.checks) {
					if (check.kind === "email") prop.format = "email";
					if (check.kind === "url") prop.format = "url";
					if (check.kind === "min") prop.minLength = check.value;
					if (check.kind === "max") prop.maxLength = check.value;
				}
			}
		} else if (def.typeName === "ZodNumber") {
			prop.type = "number";
			if (def.checks) {
				for (const check of def.checks) {
					if (check.kind === "min") prop.minimum = check.value;
					if (check.kind === "max") prop.maximum = check.value;
					if (check.kind === "int") prop.type = "integer";
				}
			}
		} else if (def.typeName === "ZodEnum") {
			prop.type = "string";
			prop.enum = def.values;
		} else if (
			def.typeName === "ZodOptional" ||
			def.typeName === "ZodDefault"
		) {
			// Recurse into the inner type
			const inner = zodToJsonSchema({
				shape: { inner: def.innerType },
			});
			Object.assign(prop, inner.properties.inner || {});
		}

		properties[key] = prop;

		// Check if required (not optional, not default)
		if (def.typeName !== "ZodOptional" && def.typeName !== "ZodDefault") {
			required.push(key);
		}
	}

	return {
		type: "object",
		properties,
		required: required.length > 0 ? required : undefined,
	};
}
