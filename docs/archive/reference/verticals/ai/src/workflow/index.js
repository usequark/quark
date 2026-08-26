import { recordToolEvent } from "../audit.js";
import {
	getUserToolAccessLevel,
	waitForToolConfirmation,
} from "../permissions.js";
import { WorkflowSchema } from "./schemas.js";

export { WorkflowSchema, WorkflowStepSchema } from "./schemas.js";

/**
 * Resolve the tool executor — injected for tests, dynamic import at runtime.
 * @param {Function} [injected]
 * @returns {Promise<(name: string, params: object) => Promise<unknown>>}
 */
async function resolveExecuteTool(injected) {
	if (typeof injected === "function") return injected;
	const mod = await import("@techstream/quark-worker/tools");
	return mod.executeTool;
}

// ── Executor ────────────────────────────────────────────────────────────────

export class WorkflowExecutor {
	/**
	 * @param {object} options
	 * @param {string} options.userId
	 * @param {string} [options.conversationId]
	 * @param {Function} [options.executeTool] - Injected tool runner (tests / custom hosts)
	 * @param {object} [options.redisClient] - Injected Redis client for confirmations
	 */
	constructor({ userId, conversationId, executeTool, redisClient } = {}) {
		this.userId = userId;
		this.conversationId = conversationId;
		this._executeToolInjected = executeTool;
		this.redisClient = redisClient;
		this.context = {};
		this.results = [];
	}

	async execute(workflow) {
		const parsed = WorkflowSchema.parse(workflow);
		this.results = [];
		this.context = { steps: {} };

		for (const step of parsed.steps) {
			const result = await this.executeStep(step);
			this.results.push(result);
			this.context.steps[step.id] = result;

			if (result.status === "error") break;
		}

		return { workflow: parsed.name, results: this.results };
	}

	async executeStep(step) {
		switch (step.type) {
			case "tool_call":
				return this.executeToolCall(step);
			case "condition":
				return this.executeCondition(step);
			case "approval":
				return this.executeApproval(step);
			case "delay":
				return this.executeDelay(step);
			default:
				return {
					stepId: step.id,
					status: "error",
					error: `Unknown step type: ${step.type}`,
				};
		}
	}

	async executeToolCall(step) {
		const accessLevel =
			step.permission || (await getUserToolAccessLevel(this.userId, step.tool));

		await recordToolEvent({
			userId: this.userId,
			conversationId: this.conversationId,
			toolName: step.tool,
			input: step.params,
			status: accessLevel === "auto" ? "auto_executed" : "proposed",
		});

		if (accessLevel === "disabled") {
			return { stepId: step.id, status: "skipped", reason: "disabled" };
		}

		if (accessLevel === "confirm") {
			const callId = `${this.conversationId || "workflow"}-${step.tool}-${Date.now()}`;
			const confirmation = await waitForToolConfirmation(
				callId,
				undefined,
				this.redisClient,
			);
			if (!confirmation.approved) {
				await recordToolEvent({
					userId: this.userId,
					conversationId: this.conversationId,
					toolName: step.tool,
					input: step.params,
					status: "denied",
					reason: confirmation.timedOut ? "timed_out" : "denied",
					callId,
				});
				return {
					stepId: step.id,
					status: "denied",
					reason: confirmation.timedOut ? "timeout" : "denied",
				};
			}
			await recordToolEvent({
				userId: this.userId,
				conversationId: this.conversationId,
				toolName: step.tool,
				input: step.params,
				status: "approved",
				callId,
			});
		}

		try {
			const executeTool = await resolveExecuteTool(this._executeToolInjected);
			const output = await executeTool(step.tool, step.params || {});
			return { stepId: step.id, status: "completed", output };
		} catch (error) {
			return { stepId: step.id, status: "error", error: error.message };
		}
	}

	async executeCondition(step) {
		try {
			// Bind `steps` and `context` so expressions can use steps.<id>.status
			const fn = new Function("steps", "context", `return (${step.condition})`);
			const result = fn(this.context.steps || {}, this.context);
			const branch = result ? step.then : step.else;
			if (!branch || branch.length === 0) {
				return {
					stepId: step.id,
					status: "completed",
					condition: result,
					branch: result ? "then" : "else",
					steps: [],
				};
			}
			const results = [];
			for (const subStep of branch) {
				const subResult = await this.executeStep(subStep);
				results.push(subResult);
				if (subResult.status === "error") break;
			}
			return {
				stepId: step.id,
				status: "completed",
				condition: result,
				branch: result ? "then" : "else",
				steps: results,
			};
		} catch (error) {
			return {
				stepId: step.id,
				status: "error",
				error: `Condition eval error: ${error.message}`,
			};
		}
	}

	async executeApproval(step) {
		const callId = `${this.conversationId || "workflow"}-approval-${Date.now()}`;
		const confirmation = await waitForToolConfirmation(
			callId,
			undefined,
			this.redisClient,
		);
		return {
			stepId: step.id,
			status: confirmation.approved ? "approved" : "denied",
			reason: confirmation.timedOut ? "timeout" : undefined,
		};
	}

	async executeDelay(step) {
		await new Promise((resolve) => setTimeout(resolve, step.delayMs || 1000));
		return { stepId: step.id, status: "completed" };
	}
}
