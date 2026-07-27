import { AppError, ValidationError } from "@techstream/quark-core/errors";
import { toolHandlers } from "./handlers.js";
import { getVisibleTools } from "./permissions.js";
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
		throw new ValidationError(`Unknown tool: ${name}`);
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
 * Get filtered tool definitions based on user role.
 * Only returns tools the user has permission to use.
 * @param {string} role - User's role (e.g. "admin", "editor", "viewer")
 * @returns {Object[]}
 */
export function getAllFilteredToolDefinitions(role) {
	const names = getToolNames();
	const visible = getVisibleTools(role, names);
	return visible.map((name) => getToolDefinition(name));
}

/**
 * Get the handler function for a tool.
 * @param {string} name
 * @returns {Function}
 */
export function getToolHandler(name) {
	const handler = toolHandlers[name];
	if (!handler) {
		throw new AppError(`No handler for tool: ${name}`, 500, "NO_TOOL_HANDLER");
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
		throw new ValidationError(`Unknown tool: ${name}`);
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

		// Context tools
		get_context: "Retrieve context records by category",
		create_context: "Create a new context record (key-value with category)",
		update_context: "Update an existing context record",
		delete_context: "Delete a context record",
		search_context: "Search context records by key or value",

		search_jobs: "Search background jobs by name, status, or queue",

		web_search: "Search the web for current information on a topic",
	};
	return descriptions[name] || `Execute ${name} tool`;
}

/**
 * Convert a single Zod type to its JSON Schema property representation.
 * Handles the Zod types used across tool schemas.
 */
function zodTypeToJsonSchema(zodType) {
	const def = zodType._def;

	switch (def.typeName) {
		case "ZodString": {
			const prop = { type: "string" };
			if (def.checks) {
				for (const check of def.checks) {
					if (check.kind === "email") prop.format = "email";
					if (check.kind === "url") prop.format = "url";
					if (check.kind === "min") prop.minLength = check.value;
					if (check.kind === "max") prop.maxLength = check.value;
				}
			}
			return prop;
		}
		case "ZodNumber": {
			const prop = { type: "number" };
			if (def.checks) {
				for (const check of def.checks) {
					if (check.kind === "min") prop.minimum = check.value;
					if (check.kind === "max") prop.maximum = check.value;
					if (check.kind === "int") prop.type = "integer";
				}
			}
			return prop;
		}
		case "ZodEnum":
			return { type: "string", enum: def.values };
		case "ZodArray":
			return {
				type: "array",
				items: zodTypeToJsonSchema(def.type),
			};
		case "ZodObject":
			// Nested object — recurse using the object converter
			return zodObjectToJsonSchema(zodType);
		case "ZodNullable": {
			const inner = zodTypeToJsonSchema(def.innerType);
			return { ...inner, nullable: true };
		}
		case "ZodOptional":
		case "ZodDefault":
			return zodTypeToJsonSchema(def.innerType);
		case "ZodUnion":
			return { oneOf: def.options.map((opt) => zodTypeToJsonSchema(opt)) };
		default:
			// Unknown/unhandled Zod type — fall back to string so tool calls
			// degrade gracefully instead of silently omitting the parameter.
			return { type: "string" };
	}
}

/**
 * Convert a Zod object schema to JSON Schema format.
 * @param {import("zod").ZodObject} schema
 * @returns {object}
 */
function zodObjectToJsonSchema(schema) {
	const shape = schema.shape;
	const properties = {};
	const required = [];

	for (const [key, zodType] of Object.entries(shape)) {
		properties[key] = zodTypeToJsonSchema(zodType);

		const def = zodType._def;
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

/**
 * Convert a Zod schema to JSON Schema format.
 * Entry point — delegates to the recursive type converter.
 */
function zodToJsonSchema(schema) {
	return zodObjectToJsonSchema(schema);
}
