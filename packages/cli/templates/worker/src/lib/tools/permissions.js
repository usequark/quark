import { createAuthorization } from "@techstream/quark-core";

const auth = createAuthorization();

/**
 * Maps tool names to { resource, action } pairs for authorization.
 * Each tool requires the user to have a specific permission.
 *
 * @type {Record<string, { resource: string, action: string }>}
 */
export const toolPermissions = {
	// CRM tools
	search_contacts: { resource: "contact", action: "read" },
	create_contact: { resource: "contact", action: "create" },
	update_contact: { resource: "contact", action: "update" },
	search_companies: { resource: "company", action: "read" },
	create_company: { resource: "company", action: "create" },
	update_company: { resource: "company", action: "update" },
	search_deals: { resource: "deal", action: "read" },
	create_deal: { resource: "deal", action: "create" },
	update_deal: { resource: "deal", action: "update" },
	get_conversation_history: { resource: "conversation", action: "read" },
	search_jobs: { resource: "job", action: "read" },

	// Context tools
	get_context: { resource: "context", action: "read" },
	create_context: { resource: "context", action: "create" },
	update_context: { resource: "context", action: "update" },
	delete_context: { resource: "context", action: "delete" },
	search_context: { resource: "context", action: "read" },
	web_search: { resource: "web", action: "read" },
};

/**
 * Get the permission required for a tool.
 * @param {string} toolName
 * @returns {{ resource: string, action: string }|null}
 */
export function getToolPermission(toolName) {
	return toolPermissions[toolName] || null;
}

/**
 * Filter tool names based on user's role.
 * @param {string} role - User's role (e.g. "admin", "editor", "viewer")
 * @param {string[]} toolNames - All available tool names
 * @returns {string[]} Filtered tool names the user can use
 */
export function getVisibleTools(role, toolNames) {
	if (role === "admin") return toolNames; // Skip check for admin (fast path)

	return toolNames.filter((name) => {
		const perm = toolPermissions[name];
		if (!perm) return false; // Unknown tools are denied by default
		return auth.hasPermission(role, perm.action, perm.resource);
	});
}

export { auth };
