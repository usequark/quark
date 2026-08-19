import { prisma } from "@techstream/quark-db";

const ROLE_PRESETS = {
	admin: "auto",
	editor: "confirm",
	viewer: "disabled",
	client_admin: "auto",
	lead_dev: "auto",
};

const WRITE_TOOLS = new Set([
	"create_contact",
	"update_contact",
	"create_company",
	"update_company",
	"create_deal",
	"update_deal",
	"create_context",
	"update_context",
	"delete_context",
]);

/** Fallback tool names when worker tool registry is unavailable. */
export const KNOWN_TOOL_NAMES = [
	"search_contacts",
	"create_contact",
	"update_contact",
	"search_companies",
	"create_company",
	"update_company",
	"search_deals",
	"create_deal",
	"update_deal",
	"get_conversation_history",
	"get_context",
	"create_context",
	"update_context",
	"delete_context",
	"search_context",
	"search_jobs",
	"web_search",
];

/**
 * Resolve the default access level for a role + tool combination.
 *
 * @param {string} role
 * @param {string} toolName
 * @returns {"auto"|"confirm"|"disabled"}
 */
export function getDefaultAccessLevel(role, toolName) {
	const base = ROLE_PRESETS[role] || "auto";
	if (base === "confirm" && !WRITE_TOOLS.has(toolName)) return "auto";
	return base;
}

/**
 * Resolve registered tool names from the worker registry when available.
 * @returns {Promise<string[]>}
 */
async function resolveToolNames() {
	try {
		const mod = await import("@techstream/quark-worker/tools");
		if (typeof mod.getToolNames === "function") {
			return mod.getToolNames();
		}
	} catch {
		// Worker package may not be resolvable outside the worker process.
	}
	return KNOWN_TOOL_NAMES;
}

/**
 * Bulk upsert all tools with role-based default access levels.
 *
 * @param {string} userId
 * @param {string} role
 * @param {string[]} [toolNames] - Optional explicit tool list (for tests)
 */
export async function applyRolePresets(userId, role, toolNames) {
	const names = toolNames || (await resolveToolNames());
	const operations = names.map((toolName) =>
		prisma.aiToolPermission.upsert({
			where: { userId_toolName: { userId, toolName } },
			update: { accessLevel: getDefaultAccessLevel(role, toolName) },
			create: {
				userId,
				toolName,
				accessLevel: getDefaultAccessLevel(role, toolName),
			},
		}),
	);
	await prisma.$transaction(operations);
}
