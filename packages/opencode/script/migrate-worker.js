import path from "node:path";
import fs from "fs-extra";

/**
 * Migrates a Quark project's worker to support AI jobs.
 *
 * Three modifications:
 *   A. Add AI queue/job-name entries to packages/jobs/src/definitions.js
 *   B. Create apps/worker/src/handlers/ai.js with the AI job handlers
 *   C. Wire the AI handlers into apps/worker/src/handlers/index.js
 *
 * All steps are idempotent - if the relevant entries or files already exist
 * they are skipped.
 *
 * @param {string} projectDir - Root directory of the Quark project
 * @returns {Promise<string>} "DONE"
 */
export default async function migrateWorker(projectDir) {
	const scope = await detectScope(projectDir);
	if (!scope) {
		throw new Error(
			"Could not detect project scope. Ensure the root package.json has a @scope/name field.",
		);
	}

	await modifyDefinitions(projectDir);
	await createAiHandler(projectDir, scope);
	await addWorkerDependency(projectDir);
	await updateHandlerIndex(projectDir);
	await addEnvExample(projectDir);
	await createAdminAiPage(projectDir, scope);
	await updateAdminConfig(projectDir);
	await updateSidebar(projectDir);

	return "DONE";
}

// ── Scope detection ──────────────────────────────────────────────────────────

/**
 * Read the project scope from `.quark-link.json` (if it has a `scope` field)
 * or fall back to extracting it from the root `package.json` name field
 * (e.g. `@myapp/web` → `"myapp"`).
 *
 * @param {string} projectDir
 * @returns {Promise<string|null>}
 */
async function detectScope(projectDir) {
	// Try .quark-link.json first
	const quarkLinkPath = path.join(projectDir, ".quark-link.json");
	if (await fs.pathExists(quarkLinkPath)) {
		try {
			const quarkLink = await fs.readJson(quarkLinkPath);
			if (quarkLink.scope) return quarkLink.scope;
		} catch {
			// ignore malformed json, fall through to package.json
		}
	}

	// Fall back to root package.json
	const pkgPath = path.join(projectDir, "package.json");
	if (await fs.pathExists(pkgPath)) {
		try {
			const pkg = await fs.readJson(pkgPath);
			const match = pkg.name?.match(/^@([^/]+)\//);
			if (match) return match[1];
		} catch {
			// ignore
		}
	}

	return null;
}

// ── A. Modify packages/jobs/src/definitions.js ───────────────────────────────

/**
 * Add AI queue and job-name entries to the definitions file.
 * Skips if the entries already exist.
 *
 * @param {string} projectDir
 */
async function modifyDefinitions(projectDir) {
	const defsPath = path.join(
		projectDir,
		"packages",
		"jobs",
		"src",
		"definitions.js",
	);
	if (!(await fs.pathExists(defsPath))) return;

	let content = await fs.readFile(defsPath, "utf-8");
	let changed = false;

	// ── Add AI queue to JOB_QUEUES ────────────────────────────────────────
	const hasAiQueue = /JOB_QUEUES\s*=\s*\{[\s\S]*?\bAI\s*:/.test(content);
	if (!hasAiQueue) {
		content = content.replace(
			/(export const JOB_QUEUES\s*=\s*\{[\s\S]*?)(\n\};)/,
			(_match, before, after) => {
				return `${before}\n\tAI: "ai-queue",${after}`;
			},
		);
		changed = true;
	}

	// ── Add AI job names to JOB_NAMES ─────────────────────────────────────
	const hasAiAgentTask = /JOB_NAMES\s*=\s*\{[\s\S]*?\bAI_AGENT_TASK\s*:/.test(
		content,
	);
	if (!hasAiAgentTask) {
		content = content.replace(
			/(export const JOB_NAMES\s*=\s*\{[\s\S]*?)(\n\};)/,
			(_match, before, after) => {
				return (
					before +
					'\n\tAI_AGENT_TASK: "ai-agent-task",\n\tAI_SESSION_CREATE: "ai-session-create",\n\tAI_HEALTH_CHECK: "ai-health-check",' +
					after
				);
			},
		);
		changed = true;
	}

	if (changed) {
		await fs.writeFile(defsPath, content);
	}
}

// ── B. Create apps/worker/src/handlers/ai.js ─────────────────────────────────

/**
 * Write the AI job handler file. Skips if it already exists.
 *
 * @param {string} projectDir
 * @param {string} scope
 */
async function createAiHandler(projectDir, scope) {
	const handlerPath = path.join(
		projectDir,
		"apps",
		"worker",
		"src",
		"handlers",
		"ai.js",
	);
	if (await fs.pathExists(handlerPath)) return;

	const content = `/**
 * AI Job Handler
 * Dispatches prompts to the OpenCode server via the TypeScript SDK.
 * The OpenCode server runs on Railway internal networking at http://opencode.railway.internal:4096.
 */

import { createLogger } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { JOB_NAMES } from "@${scope}/jobs";

const logger = createLogger("worker:ai");

/**
 * Handles an AI agent task job.
 * Creates an OpenCode session and sends a prompt, returning the result.
 *
 * Job data expected:
 *   - prompt: string - the prompt text to send
 *   - agent: string - the agent to use (e.g., "assistant", "strategist")
 *   - sessionTitle: string - optional title for the session
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleAiAgentTask(bullJob, logger) {
	const { prompt, agent = "assistant", sessionTitle } = bullJob.data;

	if (!prompt) {
		throw new AppError("AI agent task requires a prompt", 400, "AI_PROMPT_REQUIRED");
	}

	const baseUrl = process.env.OPENCODE_SERVER_URL || "http://opencode.railway.internal:4096";

	logger.info("Dispatching AI agent task", {
		job: JOB_NAMES.AI_AGENT_TASK,
		agent,
		sessionTitle: sessionTitle || "(untitled)",
		baseUrl,
	});

	try {
		const { createOpencodeClient } = await import("@opencode-ai/sdk");

		const client = createOpencodeClient({ baseUrl });

		const session = await client.session.create({
			body: {
				title: sessionTitle || \`AI Task: \${agent}\`,
			},
		});

		const result = await client.session.prompt({
			path: { id: session.id },
			body: {
				agent,
				parts: [{ type: "text", text: prompt }],
			},
		});

		logger.info("AI agent task completed", {
			job: JOB_NAMES.AI_AGENT_TASK,
			sessionId: session.id,
			agent,
		});

		return {
			sessionId: session.id,
			output: result.data,
		};
	} catch (error) {
		logger.error("AI agent task failed", {
			job: JOB_NAMES.AI_AGENT_TASK,
			error: error.message,
			agent,
		});
		throw new AppError(
			\`AI agent task failed: \${error.message}\`,
			502,
			"AI_AGENT_TASK_FAILED",
		);
	}
}

/**
 * Handles an AI session create job.
 * Creates a new OpenCode session and returns the session ID.
 *
 * Job data expected:
 *   - title: string - optional session title
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleAiSessionCreate(bullJob, logger) {
	const { title } = bullJob.data;

	const baseUrl = process.env.OPENCODE_SERVER_URL || "http://opencode.railway.internal:4096";

	logger.info("Creating AI session", { job: JOB_NAMES.AI_SESSION_CREATE, title: title || "(untitled)" });

	try {
		const { createOpencodeClient } = await import("@opencode-ai/sdk");

		const client = createOpencodeClient({ baseUrl });

		const session = await client.session.create({
			body: {
				title: title || "AI Session",
			},
		});

		logger.info("AI session created", { job: JOB_NAMES.AI_SESSION_CREATE, sessionId: session.id });

		return {
			sessionId: session.id,
		};
	} catch (error) {
		logger.error("AI session creation failed", {
			job: JOB_NAMES.AI_SESSION_CREATE,
			error: error.message,
		});
		throw new AppError(
			\`AI session creation failed: \${error.message}\`,
			502,
			"AI_SESSION_CREATE_FAILED",
		);
	}
}

/**
 * Handles an AI health check job.
 * Calls GET /health on the OpenCode server to verify connectivity.
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleAiHealthCheck(bullJob, logger) {
	const baseUrl = process.env.OPENCODE_SERVER_URL || "http://opencode.railway.internal:4096";

	logger.info("Checking AI server health", { job: JOB_NAMES.AI_HEALTH_CHECK, baseUrl });

	try {
		const response = await fetch(\`\${baseUrl}/health\`);

		if (!response.ok) {
			throw new Error(\`Health check returned \${response.status}: \${response.statusText}\`);
		}

		const data = await response.json();

		logger.info("AI server health check passed", {
			job: JOB_NAMES.AI_HEALTH_CHECK,
			serverStatus: data,
		});

		return {
			status: "ok",
			serverStatus: data,
		};
	} catch (error) {
		logger.error("AI server health check failed", {
			job: JOB_NAMES.AI_HEALTH_CHECK,
			error: error.message,
		});
		throw new AppError(
			\`AI server health check failed: \${error.message}\`,
			502,
			"AI_HEALTH_CHECK_FAILED",
		);
	}
}
`;

	await fs.writeFile(handlerPath, content);
}

// ── C. Update apps/worker/src/handlers/index.js ──────────────────────────────

/**
 * Wire the AI handlers into the handler registry.
 * Skips if the import or registrations already exist.
 *
 * @param {string} projectDir
 */
async function updateHandlerIndex(projectDir) {
	const indexPath = path.join(
		projectDir,
		"apps",
		"worker",
		"src",
		"handlers",
		"index.js",
	);
	if (!(await fs.pathExists(indexPath))) return;

	let content = await fs.readFile(indexPath, "utf-8");
	let changed = false;

	// ── Add AI handler import ─────────────────────────────────────────────
	if (!content.includes('"./ai.js"')) {
		const lines = content.split("\n");
		let lastImportLine = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim().startsWith("import ")) {
				lastImportLine = i;
			}
		}

		if (lastImportLine >= 0) {
			lines.splice(
				lastImportLine + 1,
				0,
				'import { handleAiAgentTask, handleAiSessionCreate, handleAiHealthCheck } from "./ai.js";',
			);
			content = lines.join("\n");
			changed = true;
		}
	}

	// ── Add AI handler registrations ──────────────────────────────────────
	if (!content.includes("AI_AGENT_TASK")) {
		const lines = content.split("\n");
		let lastRegistrationLine = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim().startsWith("[JOB_NAMES.")) {
				lastRegistrationLine = i;
			}
		}

		if (lastRegistrationLine >= 0) {
			lines.splice(
				lastRegistrationLine + 1,
				0,
				"\t[JOB_NAMES.AI_AGENT_TASK]: handleAiAgentTask,",
				"\t[JOB_NAMES.AI_SESSION_CREATE]: handleAiSessionCreate,",
				"\t[JOB_NAMES.AI_HEALTH_CHECK]: handleAiHealthCheck,",
			);
			content = lines.join("\n");
			changed = true;
		}
	}

	if (changed) {
		await fs.writeFile(indexPath, content);
	}
}

// ── D. Add @opencode-ai/sdk to worker's package.json ─────────────────────────

/**
 * Add @opencode-ai/sdk to the worker's dependencies.
 * Skips if already present.
 *
 * @param {string} projectDir
 */
async function addWorkerDependency(projectDir) {
	const pkgPath = path.join(projectDir, "apps", "worker", "package.json");
	if (!(await fs.pathExists(pkgPath))) return;

	const pkg = await fs.readJson(pkgPath);
	if (!pkg.dependencies) {
		pkg.dependencies = {};
	}
	if (!pkg.dependencies["@opencode-ai/sdk"]) {
		pkg.dependencies["@opencode-ai/sdk"] = "^1.17.0";
		await fs.writeJson(pkgPath, pkg, { spaces: 2 });
	}
}

// ── E. Add env vars to .env.example ──────────────────────────────────────────

/**
 * Add OpenCode AI env vars to .env.example if missing.
 *
 * @param {string} projectDir
 */
async function addEnvExample(projectDir) {
	const envPath = path.join(projectDir, ".env.example");
	if (!(await fs.pathExists(envPath))) return;

	let content = await fs.readFile(envPath, "utf-8");
	let changed = false;

	if (!content.includes("OPENCODE_SERVER_URL")) {
		content +=
			"\n# OpenCode AI Server\nOPENCODE_SERVER_URL=http://opencode.railway.internal:4096\n";
		changed = true;
	}

	if (!content.includes("OPENROUTER_API_KEY")) {
		content += "OPENROUTER_API_KEY=\n";
		changed = true;
	}

	if (changed) {
		await fs.writeFile(envPath, content);
	}
}

// ── F. Create admin AI page, chat component, and API route ────────────────────

/**
 * Create the admin AI page, AiChat component, and chat API route.
 * All files are skipped if they already exist (idempotent).
 *
 * @param {string} projectDir
 */
async function createAdminAiPage(projectDir, scope) {
	// ── Admin AI page ─────────────────────────────────────────────────────
	const aiPagePath = path.join(
		projectDir,
		"apps",
		"web",
		"src",
		"app",
		"admin",
		"ai",
		"page.js",
	);
	if (!(await fs.pathExists(aiPagePath))) {
		await fs.ensureDir(path.dirname(aiPagePath));
		await fs.writeFile(
			aiPagePath,
			`import { getCachedSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AiChat from "./_components/AiChat";

export const metadata = { title: "AI Assistant" };

export default async function AiPage() {
	const session = await getCachedSession();
	if (!session?.user) redirect("/auth/signin?callbackUrl=/admin/ai");

	const role = session.user.role;
	if (!["admin", "lead_dev", "dev"].includes(role)) redirect("/admin");

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-text">
					AI Assistant
				</h1>
				<p className="mt-1 text-sm text-text-faint">
					Ask questions about your projects, tasks, and system status. The AI
					has access to live database context and can create/update tasks.
				</p>
			</div>
			<AiChat />
		</div>
	);
}
`,
		);
	}

	// ── AiChat component ──────────────────────────────────────────────────
	const aiChatPath = path.join(
		projectDir,
		"apps",
		"web",
		"src",
		"app",
		"admin",
		"ai",
		"_components",
		"AiChat.js",
	);
	if (!(await fs.pathExists(aiChatPath))) {
		await fs.ensureDir(path.dirname(aiChatPath));
		await fs.writeFile(
			aiChatPath,
			`"use client";

import { Button, Card, CardContent, Textarea } from "@techstream/ui";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ts-ai-chat-history";

const EXAMPLE_QUESTIONS = [
	"How many tasks are overdue?",
	"What's the status of my projects?",
	"Show me recent job failures.",
	"What was completed this week?",
];

export default function AiChat() {
	const [question, setQuestion] = useState("");
	const [conversation, setConversation] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const chatEndRef = useRef(null);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed)) setConversation(parsed);
			}
		} catch {
			// ignore
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
		} catch {
			// ignore
		}
	}, [conversation]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [conversation]);

	async function handleSubmit(e) {
		e.preventDefault();
		if (!question.trim() || loading) return;

		const userMessage = { role: "user", content: question.trim() };
		const updatedConversation = [...conversation, userMessage];
		setConversation(updatedConversation);
		setQuestion("");
		setLoading(true);
		setError(null);

		try {
			const res = await fetch("/api/ai/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: userMessage.content,
					history: updatedConversation.slice(0, -1),
				}),
			});

			const data = await res.json();

			if (!res.ok || data.error) {
				setError(data.error || \`Request failed (\${res.status})\`);
				setConversation(conversation);
				return;
			}

			setConversation((prev) => [...prev, { role: "assistant", content: data.answer || "No response received." }]);
		} catch (err) {
			setError(err.message || "Failed to send request");
			setConversation(conversation);
		} finally {
			setLoading(false);
		}
	}

	function handleClearConversation() {
		setConversation([]);
		setError(null);
		localStorage.removeItem(STORAGE_KEY);
	}

	return (
		<div className="space-y-4">
			{conversation.length > 0 && (
				<Card>
					<CardContent className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
						{conversation.map((msg, i) => (
							<div key={i} className={\`flex \${msg.role === "user" ? "justify-end" : "justify-start"}\`}>
								<div className={\`max-w-[80%] rounded-lg px-4 py-2.5 \${msg.role === "user" ? "bg-primary/10 text-text" : "bg-surface border border-border text-text"}\`}>
									<p className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-1">
										{msg.role === "user" ? "You" : "AI"}
									</p>
									<p className="text-sm whitespace-pre-wrap">{msg.content}</p>
								</div>
							</div>
						))}
						{loading && (
							<div className="flex justify-start">
								<div className="max-w-[80%] rounded-lg px-4 py-2.5 bg-surface border border-border">
									<p className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-1">AI</p>
									<div className="flex items-center gap-2">
										<Spinner />
										<p className="text-sm text-text-muted">Thinking...</p>
									</div>
								</div>
							</div>
						)}
						<div ref={chatEndRef} />
					</CardContent>
				</Card>
			)}

			{error && (
				<div className="flex items-center gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-4 py-2">
					<svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
						<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p className="text-sm">{error}</p>
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-3">
				<Textarea
					placeholder="Ask a question about your projects, tasks, or system..."
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
					rows={3}
					disabled={loading}
				/>
				<div className="flex items-center gap-2">
					<Button type="submit" disabled={loading || !question.trim()}>
						{loading ? <span className="flex items-center gap-2"><Spinner />Thinking...</span> : "Send"}
					</Button>
					{conversation.length > 0 && (
						<Button type="button" variant="secondary" onClick={handleClearConversation} disabled={loading}>
							Clear Conversation
						</Button>
					)}
				</div>
			</form>

			{conversation.length === 0 && !loading && (
				<Card>
					<CardContent className="p-6">
						<div className="space-y-4">
							<div>
								<h3 className="text-sm font-semibold text-text">Welcome to the AI Assistant</h3>
								<p className="mt-1 text-sm text-text-faint">
									I can help you understand what's happening in your workspace. Try one of these questions:
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								{EXAMPLE_QUESTIONS.map((example) => (
									<button
										key={example}
										type="button"
										onClick={() => setQuestion(example)}
										className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150 cursor-pointer"
									>
										{example}
									</button>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function Spinner() {
	return (
		<svg aria-hidden="true" className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
			<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
			<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
		</svg>
	);
}
`,
		);
	}

	// ── AI Chat API route ─────────────────────────────────────────────────
	const apiRoutePath = path.join(
		projectDir,
		"apps",
		"web",
		"src",
		"app",
		"api",
		"ai",
		"chat",
		"route.js",
	);
	if (!(await fs.pathExists(apiRoutePath))) {
		await fs.ensureDir(path.dirname(apiRoutePath));
		await fs.writeFile(
			apiRoutePath,
			`/**
 * AI Chat API Route
 *
 * POST /api/ai/chat
 *
 * Accepts a user question and optional conversation history, gathers
 * live database context, enqueues an AI job, and polls for the result.
 * Tool calling is handled by the OpenCode server's MCP integration.
 */

import { prisma } from "@${scope}/db";
import { JOB_NAMES, JOB_QUEUES } from "@${scope}/jobs";
import {
	createLogger,
	createQueue,
	validateBody,
} from "@techstream/quark-core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth";

const log = createLogger("api:ai:chat");

const historyEntrySchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string(),
});

const chatSchema = z.object({
	question: z
		.string()
		.min(1, "Question is required")
		.max(5000, "Question too long"),
	history: z
		.array(historyEntrySchema)
		.max(50, "Conversation too long")
		.default([]),
});

// ── Prompt Building ──────────────────────────────────────────────────────────

function buildSystemPrompt() {
	let prompt = \`You are the AI project assistant. You have access to live system data below. Analyze the data and answer the user's question. Be concise, specific, and actionable. Focus on priorities, risks, and recommendations.

The OpenCode server has MCP tools available for creating tasks, updating task statuses, changing priorities, assigning tasks, and adding comments. If the user asks you to perform any of these actions, respond naturally and the system will handle the tool calls server-side.\n\n\`;

	return prompt;
}

// ── Context Gathering ────────────────────────────────────────────────────────

async function gatherContext() {
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	const [
		taskCountsByStatus,
		taskCountsByPriority,
		overdueTasks,
		recentlyCompleted,
		recentJobFailures,
		activeClients,
		users,
		clients,
	] = await Promise.all([
		prisma.task.groupBy({ by: ["status"], _count: { status: true } }),
		prisma.task.groupBy({ by: ["priority"], _count: { priority: true } }),
		prisma.task.findMany({
			where: {
				dueDate: { not: null, lt: now },
				status: { notIn: ["DONE", "CANCELLED"] },
			},
			select: { id: true, title: true, priority: true, dueDate: true },
			orderBy: { dueDate: "asc" },
			take: 10,
		}),
		prisma.task.findMany({
			where: { status: "DONE", completedAt: { gte: sevenDaysAgo } },
			select: { id: true, title: true, completedAt: true },
			orderBy: { completedAt: "desc" },
			take: 10,
		}),
		prisma.job.findMany({
			where: { status: "FAILED", createdAt: { gte: twentyFourHoursAgo } },
			select: { name: true, queue: true, error: true, createdAt: true },
			orderBy: { createdAt: "desc" },
			take: 10,
		}),
		prisma.client.count({ where: { archived: false } }),
		prisma.user.findMany({
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		}),
		prisma.client.findMany({
			where: { archived: false },
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		}),
	]);

	const statusCounts = {};
	for (const row of taskCountsByStatus)
		statusCounts[row.status] = row._count.status;
	const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0);

	const priorityCounts = {};
	for (const row of taskCountsByPriority)
		priorityCounts[row.priority] = row._count.priority;

	let context = \`## Current System State\n\n\`;
	context += \`**Tasks:** \${totalTasks} total\n\`;
	context += \`- By status: \${Object.entries(statusCounts)
		.map(([k, v]) => \`\${k}: \${v}\`)
		.join(", ")}\n\`;
	context += \`- By priority: \${Object.entries(priorityCounts)
		.map(([k, v]) => \`\${k}: \${v}\`)
		.join(", ")}\n\`;
	context += \`- Active clients: \${activeClients}\n\n\`;

	if (overdueTasks.length > 0) {
		context += \`**Overdue Tasks (\${overdueTasks.length}):**\n\`;
		for (const t of overdueTasks) {
			context += \`- \${t.id}: \${t.title} (\${t.priority}, due \${t.dueDate.toISOString().split("T")[0]})\n\`;
		}
		context += "\n";
	}

	if (recentlyCompleted.length > 0) {
		context += \`**Recently Completed (past 7 days):**\n\`;
		for (const t of recentlyCompleted) {
			context += \`- \${t.id}: \${t.title}\n\`;
		}
		context += "\n";
	}

	if (recentJobFailures.length > 0) {
		context += \`**Recent Job Failures (past 24h):**\n\`;
		for (const j of recentJobFailures) {
			context += \`- \${j.name} (\${j.queue}): \${j.error?.slice(0, 100)}\n\`;
		}
		context += "\n";
	}

	context += \`**Users:**\n\`;
	for (const u of users) {
		context += \`- \${u.id}: \${u.name}\n\`;
	}
	context += "\n";

	context += \`**Clients:**\n\`;
	for (const c of clients) {
		context += \`- \${c.id}: \${c.name}\n\`;
	}
	context += "\n";

	return context;
}

function formatHistory(history) {
	if (!history || history.length === 0) return "";
	let formatted = "## Conversation History\n\n";
	for (const entry of history) {
		const label = entry.role === "user" ? "User" : "AI";
		formatted += \`\${label}: \${entry.content}\n\n\`;
	}
	return formatted;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
	try {
		const session = await getCachedSession();
		if (
			!session?.user ||
			!["admin", "lead_dev", "dev"].includes(session.user.role)
		) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		const data = await validateBody(request, chatSchema);
		const context = await gatherContext();
		const systemPrompt = buildSystemPrompt();
		const historyBlock = formatHistory(data.history);

		let fullPrompt = systemPrompt + context;
		if (historyBlock) fullPrompt += historyBlock;
		fullPrompt += \`## New Question\n\${data.question}\`;

		const queue = createQueue(JOB_QUEUES.AI, {
			defaultJobOptions: { removeOnComplete: { age: 60, count: 100 } },
		});

		const job = await queue.add(JOB_NAMES.AI_AGENT_TASK, {
			prompt: fullPrompt,
			agent: "assistant",
			sessionTitle: \`AI Chat: \${data.question.slice(0, 50)}\`,
		});

		log.info("AI chat job enqueued", {
			jobId: job.id,
			historyLength: data.history.length,
			promptLength: fullPrompt.length,
		});

		// Poll for up to 30 seconds
		const maxWaitMs = 30_000;
		const pollIntervalMs = 500;
		let waited = 0;

		while (waited < maxWaitMs) {
			const state = await job.getState();

			if (state === "completed") {
				const freshJob = await queue.getJob(job.id);
				const result = freshJob ? freshJob.returnvalue : null;

				let answer = "No response";
				if (result?.output?.parts) {
					answer = result.output.parts
						.filter((p) => p.type === "text")
						.map((p) => p.text)
						.join("\n");
				} else if (result?.output?.info) {
					answer = JSON.stringify(result.output);
				}

				return NextResponse.json({
					success: true,
					jobId: job.id,
					answer,
				});
			}

			if (state === "failed") {
				const freshJob = await queue.getJob(job.id);
				const failedReason = freshJob
					? freshJob.failedReason
					: job.failedReason;
				return NextResponse.json(
					{ success: false, error: failedReason || "Job failed" },
					{ status: 502 },
				);
			}

			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
			waited += pollIntervalMs;
		}

		return NextResponse.json({
			success: true,
			jobId: job.id,
			status: "processing",
			message: "Job is still processing. Check the worker logs.",
		});
	} catch (error) {
		log.error("AI chat endpoint failed", {
			error: error?.stack ?? error?.message ?? String(error),
		});
		return NextResponse.json(
			{ success: false, error: "Failed to process AI request" },
			{ status: 500 },
		);
	}
}
`,
		);
	}
}

// ── G. Add tools array to admin config ────────────────────────────────────────

/**
 * Add a \`tools\` array to the admin config if it doesn't already have one.
 * The tools array is inserted after \`pageSize\` and before \`modelOverrides\`.
 *
 * @param {string} projectDir
 */
async function updateAdminConfig(projectDir) {
	const configPath = path.join(
		projectDir,
		"packages",
		"admin",
		"src",
		"config.js",
	);
	if (!(await fs.pathExists(configPath))) return;

	let content = await fs.readFile(configPath, "utf-8");

	// Skip if tools already exists
	if (content.includes("tools:")) return;

	// Insert tools array after pageSize line and before modelOverrides
	content = content.replace(
		/(\tpageSize: \d+,)([\s\S]*?)(\tmodelOverrides:)/,
		(_match, pageSizeLine, _between, modelOverrides) => {
			return (
				pageSizeLine +
				'\n\n\t/**\n\t * Custom tool pages shown in the sidebar Tools section.\n\t * Each tool maps to `/admin/{slug}`.\n\t *\n\t * @type {Array<{slug: string, label: string, icon: string}>}\n\t */\n\ttools: [\n\t\t{ slug: "ai", label: "AI", icon: "bot" },\n\t],\n' +
				modelOverrides
			);
		},
	);

	await fs.writeFile(configPath, content);
}

// ── H. Add Bot icon to sidebar ────────────────────────────────────────────────

/**
 * Add the \`Bot\` icon import from lucide-react and the \`TOOL_ICONS\` mapping
 * to the admin sidebar. Skips if already present.
 *
 * @param {string} projectDir
 */
async function updateSidebar(projectDir) {
	const sidebarPath = path.join(
		projectDir,
		"apps",
		"web",
		"src",
		"app",
		"admin",
		"_components",
		"Sidebar.js",
	);
	if (!(await fs.pathExists(sidebarPath))) return;

	let content = await fs.readFile(sidebarPath, "utf-8");
	let changed = false;

	// Add Bot to lucide-react import
	if (!content.includes("lucide-react")) {
		// Add import after the existing imports
		content = content.replace(
			/(import SignOutButton from "\.\/SignOutButton";)/,
			'import { Bot } from "lucide-react";\n$1',
		);
		changed = true;
	} else if (!content.includes("Bot")) {
		// Add Bot to existing lucide-react import
		content = content.replace(
			/import \{([^}]*)\} from "lucide-react";/,
			(_, existing) => {
				const icons = existing
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
				if (!icons.includes("Bot")) {
					icons.push("Bot");
				}
				return `import { ${icons.join(", ")} } from "lucide-react";`;
			},
		);
		changed = true;
	}

	// Add TOOL_ICONS mapping if not present
	if (!content.includes("TOOL_ICONS")) {
		// Find a good insertion point - after the last import or after component definition
		const modelSectionMatch = content.match(/(function ModelSection\s*\{)/);
		if (modelSectionMatch) {
			content = content.replace(
				modelSectionMatch[0],
				`const TOOL_ICONS = {\n\tbot: Bot,\n};\n\n${modelSectionMatch[0]}`,
			);
			changed = true;
		}
	}

	if (changed) {
		await fs.writeFile(sidebarPath, content);
	}
}
