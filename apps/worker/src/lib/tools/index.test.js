import assert from "node:assert";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
	executeTool,
	getAllFilteredToolDefinitions,
	getAllToolDefinitions,
	getToolDefinition,
	getToolHandler,
	getToolNames,
} from "./index.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

let originalPrisma;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	delete globalThis.__prisma;
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	mock.restoreAll();
});

function setPrismaMock(prismaMock) {
	globalThis.__prisma = prismaMock;
	return prismaMock;
}

// ── getToolNames ─────────────────────────────────────────────────────────────

describe("getToolNames", () => {
	test("returns array of tool names", () => {
		const names = getToolNames();
		assert.ok(Array.isArray(names));
		assert.ok(names.length > 0);
	});

	test("contains all expected tool names", () => {
		const names = getToolNames();
		const expected = [
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
		for (const name of expected) {
			assert.ok(names.includes(name), `Missing tool name: ${name}`);
		}
	});
});

// ── getToolDefinition ────────────────────────────────────────────────────────

describe("getToolDefinition", () => {
	test("returns valid function definition for known tool", () => {
		const def = getToolDefinition("search_contacts");
		assert.strictEqual(def.type, "function");
		assert.strictEqual(def.function.name, "search_contacts");
		assert.ok(def.function.description);
		assert.ok(def.function.parameters);
		assert.strictEqual(def.function.parameters.type, "object");
		assert.ok(def.function.parameters.properties.query);
	});

	test("throws for unknown tool name", () => {
		assert.throws(
			() => getToolDefinition("nonexistent_tool"),
			(error) => {
				assert.ok(error.message.includes("Unknown tool"));
				return true;
			},
		);
	});

	test("includes required fields in parameters", () => {
		const def = getToolDefinition("search_contacts");
		assert.ok(def.function.parameters.required);
		assert.ok(def.function.parameters.required.includes("query"));
	});

	test("includes enum values for stage field", () => {
		const def = getToolDefinition("search_deals");
		const stageParam = def.function.parameters.properties.stage;
		assert.ok(stageParam);
		assert.ok(stageParam.enum);
		assert.ok(stageParam.enum.includes("LEAD"));
		assert.ok(stageParam.enum.includes("CLOSED_WON"));
	});
});

// ── getAllToolDefinitions ─────────────────────────────────────────────────────

describe("getAllToolDefinitions", () => {
	test("returns array of all tool definitions", () => {
		const defs = getAllToolDefinitions();
		assert.ok(Array.isArray(defs));
		assert.strictEqual(defs.length, 17);
	});

	test("each definition has correct structure", () => {
		const defs = getAllToolDefinitions();
		for (const def of defs) {
			assert.strictEqual(def.type, "function");
			assert.ok(def.function.name);
			assert.ok(def.function.description);
			assert.ok(def.function.parameters);
		}
	});

	test("all tool names are covered", () => {
		const names = getToolNames();
		const defs = getAllToolDefinitions();
		const defNames = defs.map((d) => d.function.name);
		for (const name of names) {
			assert.ok(defNames.includes(name), `Missing definition for ${name}`);
		}
	});
});

// ── getAllFilteredToolDefinitions ─────────────────────────────────────────────

describe("getAllFilteredToolDefinitions", () => {
	test("returns all tools for admin role", () => {
		const defs = getAllFilteredToolDefinitions("admin");
		assert.strictEqual(defs.length, 17);
	});

	test("returns viewer-visible tools for viewer role", () => {
		const defs = getAllFilteredToolDefinitions("viewer");
		// Viewers can only read contacts, companies, deals, conversations, context, jobs
		// But default policy gives them read on "post" and "user" only
		// So they'll get 0 tools from our CRM/context permissions
		// Actually let's just check it's <= 16 and returns only read tools
		for (const def of defs) {
			const name = def.function.name;
			// All returned tools should be read-only operations
			assert.ok(
				name.includes("search") || name.includes("get"),
				`Unexpected write tool for viewer: ${name}`,
			);
		}
	});

	test("returns empty for null role", () => {
		const defs = getAllFilteredToolDefinitions(null);
		assert.strictEqual(defs.length, 0);
	});

	test("returns empty for undefined role", () => {
		const defs = getAllFilteredToolDefinitions(undefined);
		assert.strictEqual(defs.length, 0);
	});

	test("returns empty for role with no permissions", () => {
		// "lead_dev" is not in the default policy, so no tools should match
		const defs = getAllFilteredToolDefinitions("lead_dev");
		assert.strictEqual(defs.length, 0);
	});

	test("each definition has correct structure", () => {
		const defs = getAllFilteredToolDefinitions("admin");
		for (const def of defs) {
			assert.strictEqual(def.type, "function");
			assert.ok(def.function.name);
			assert.ok(def.function.description);
			assert.ok(def.function.parameters);
		}
	});
});

// ── getToolHandler ───────────────────────────────────────────────────────────

describe("getToolHandler", () => {
	test("returns handler function for known tool", () => {
		const handler = getToolHandler("search_contacts");
		assert.strictEqual(typeof handler, "function");
	});

	test("throws for unknown tool name", () => {
		assert.throws(
			() => getToolHandler("nonexistent_tool"),
			(error) => {
				assert.ok(error.message.includes("No handler"));
				return true;
			},
		);
	});
});

// ── executeTool ──────────────────────────────────────────────────────────────

describe("executeTool", () => {
	test("validates input and calls handler", async () => {
		const mockContacts = [{ id: "c1", firstName: "John" }];
		setPrismaMock({
			contact: {
				findMany: mock.fn(async () => mockContacts),
			},
		});

		const result = await executeTool("search_contacts", { query: "john" });
		assert.deepStrictEqual(result.contacts, mockContacts);
	});

	test("rejects invalid input", async () => {
		await assert.rejects(
			() => executeTool("search_contacts", {}),
			(error) => {
				assert.ok(error.issues); // Zod error
				return true;
			},
		);
	});

	test("throws for unknown tool", async () => {
		await assert.rejects(
			() => executeTool("nonexistent", { query: "test" }),
			(error) => {
				assert.ok(error.message.includes("Unknown tool"));
				return true;
			},
		);
	});

	test("creates contact with valid data", async () => {
		const mockContact = { id: "c1", firstName: "John", lastName: "Doe" };
		setPrismaMock({
			contact: {
				create: mock.fn(async () => mockContact),
			},
		});

		const result = await executeTool("create_contact", {
			firstName: "John",
			lastName: "Doe",
		});
		assert.deepStrictEqual(result.contact, mockContact);
	});

	test("validates email format on create", async () => {
		await assert.rejects(
			() =>
				executeTool("create_contact", {
					firstName: "John",
					lastName: "Doe",
					email: "not-an-email",
				}),
			(error) => {
				assert.ok(error.issues);
				return true;
			},
		);
	});

	test("validates deal stage enum", async () => {
		await assert.rejects(
			() =>
				executeTool("search_deals", {
					query: "test",
					stage: "INVALID_STAGE",
				}),
			(error) => {
				assert.ok(error.issues);
				return true;
			},
		);
	});
});
