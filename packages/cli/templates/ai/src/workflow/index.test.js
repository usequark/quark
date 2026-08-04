import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
	WorkflowExecutor,
	WorkflowSchema,
	WorkflowStepSchema,
} from "./index.js";

let originalPrisma;

beforeEach(() => {
	originalPrisma = globalThis.__prisma;
	globalThis.__prisma = {
		aiToolPermission: {
			findUnique: mock.fn(async () => null),
		},
		aiToolEvent: {
			create: mock.fn(async (args) => ({ id: "evt-1", ...args.data })),
			upsert: mock.fn(async (args) => ({
				id: "evt-1",
				...args.create,
				...args.update,
			})),
		},
	};
});

afterEach(() => {
	if (originalPrisma !== undefined) {
		globalThis.__prisma = originalPrisma;
	} else {
		delete globalThis.__prisma;
	}
	mock.restoreAll();
});

describe("WorkflowSchema", () => {
	test("parses a minimal workflow", () => {
		const parsed = WorkflowSchema.parse({
			name: "Test",
			steps: [{ id: "s1", type: "delay", delayMs: 1 }],
		});
		assert.equal(parsed.name, "Test");
		assert.equal(parsed.trigger, "manual");
		assert.equal(parsed.enabled, true);
	});

	test("rejects empty name", () => {
		assert.throws(() =>
			WorkflowSchema.parse({
				name: "",
				steps: [],
			}),
		);
	});

	test("parses nested condition branches", () => {
		const step = WorkflowStepSchema.parse({
			id: "c1",
			type: "condition",
			condition: "true",
			// biome-ignore lint/suspicious/noThenProperty: workflow conditional branches
			then: [{ id: "t1", type: "delay", delayMs: 1 }],
			else: [{ id: "e1", type: "delay", delayMs: 1 }],
		});
		assert.equal(step.then.length, 1);
		assert.equal(step.else.length, 1);
	});
});

describe("WorkflowExecutor", () => {
	test("executes delay steps", async () => {
		const executor = new WorkflowExecutor({
			userId: "user-1",
			conversationId: "conv-1",
		});
		const result = await executor.execute({
			name: "delay-flow",
			steps: [{ id: "d1", type: "delay", delayMs: 5 }],
		});
		assert.equal(result.workflow, "delay-flow");
		assert.equal(result.results[0].status, "completed");
		assert.equal(result.results[0].stepId, "d1");
	});

	test("executes tool_call with injected executor", async () => {
		const executeTool = mock.fn(async (name, params) => ({
			ok: true,
			name,
			params,
		}));
		const executor = new WorkflowExecutor({
			userId: "user-1",
			conversationId: "conv-1",
			executeTool,
		});
		const result = await executor.execute({
			name: "tool-flow",
			steps: [
				{
					id: "t1",
					type: "tool_call",
					tool: "search_contacts",
					params: { query: "ada" },
					permission: "auto",
				},
			],
		});
		assert.equal(result.results[0].status, "completed");
		assert.deepEqual(result.results[0].output, {
			ok: true,
			name: "search_contacts",
			params: { query: "ada" },
		});
		assert.equal(executeTool.mock.callCount(), 1);
	});

	test("skips disabled tools", async () => {
		const executeTool = mock.fn(async () => ({ ok: true }));
		const executor = new WorkflowExecutor({
			userId: "user-1",
			executeTool,
		});
		const result = await executor.execute({
			name: "disabled-flow",
			steps: [
				{
					id: "t1",
					type: "tool_call",
					tool: "create_contact",
					permission: "disabled",
				},
			],
		});
		assert.equal(result.results[0].status, "skipped");
		assert.equal(result.results[0].reason, "disabled");
		assert.equal(executeTool.mock.callCount(), 0);
	});

	test("evaluates condition branches against steps context", async () => {
		const executor = new WorkflowExecutor({ userId: "user-1" });
		const result = await executor.execute({
			name: "cond-flow",
			steps: [
				{ id: "d1", type: "delay", delayMs: 1 },
				{
					id: "c1",
					type: "condition",
					condition: 'steps.d1.status === "completed"',
					// biome-ignore lint/suspicious/noThenProperty: workflow conditional branches
					then: [{ id: "then1", type: "delay", delayMs: 1 }],
					else: [{ id: "else1", type: "delay", delayMs: 1 }],
				},
			],
		});
		assert.equal(result.results[1].status, "completed");
		assert.equal(result.results[1].branch, "then");
		assert.equal(result.results[1].steps[0].stepId, "then1");
	});

	test("condition with always-true expression runs then branch", async () => {
		const executor = new WorkflowExecutor({ userId: "user-1" });
		const result = await executor.execute({
			name: "true-cond",
			steps: [
				{
					id: "c1",
					type: "condition",
					condition: "true",
					// biome-ignore lint/suspicious/noThenProperty: workflow conditional branches
					then: [{ id: "then1", type: "delay", delayMs: 1 }],
					else: [{ id: "else1", type: "delay", delayMs: 1 }],
				},
			],
		});
		assert.equal(result.results[0].status, "completed");
		assert.equal(result.results[0].branch, "then");
		assert.equal(result.results[0].steps[0].stepId, "then1");
	});

	test("stops on tool error", async () => {
		const executeTool = mock.fn(async () => {
			throw new Error("boom");
		});
		const executor = new WorkflowExecutor({
			userId: "user-1",
			executeTool,
		});
		const result = await executor.execute({
			name: "err-flow",
			steps: [
				{
					id: "t1",
					type: "tool_call",
					tool: "search_contacts",
					permission: "auto",
				},
				{ id: "d1", type: "delay", delayMs: 1 },
			],
		});
		assert.equal(result.results[0].status, "error");
		assert.equal(result.results.length, 1);
	});

	test("returns error for unknown step type via direct executeStep", async () => {
		const executor = new WorkflowExecutor({ userId: "user-1" });
		const result = await executor.executeStep({
			id: "x",
			type: "unknown",
		});
		assert.equal(result.status, "error");
		assert.match(result.error, /Unknown step type/);
	});
});
