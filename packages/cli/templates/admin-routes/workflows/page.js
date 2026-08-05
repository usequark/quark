"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STEP_TYPES = [
	{ value: "tool_call", label: "Tool Call" },
	{ value: "condition", label: "Condition" },
	{ value: "approval", label: "Approval" },
	{ value: "delay", label: "Delay" },
];

const TOOL_OPTIONS = [
	"search_contacts",
	"create_contact",
	"update_contact",
	"search_companies",
	"create_company",
	"update_company",
	"search_deals",
	"create_deal",
	"update_deal",
	"get_context",
	"create_context",
	"update_context",
	"delete_context",
	"search_context",
	"search_jobs",
	"web_search",
];

const EMPTY_STEP = {
	id: "",
	type: "tool_call",
	tool: "search_contacts",
	params: "{}",
	condition: "",
	permission: "",
	delayMs: "1000",
	description: "",
};

function newStep() {
	return {
		...EMPTY_STEP,
		id: `step_${Date.now().toString(36)}`,
	};
}

function stepsToApi(steps) {
	return steps.map((s) => {
		const step = {
			id: s.id || `step_${Math.random().toString(36).slice(2, 8)}`,
			type: s.type,
			description: s.description || undefined,
		};
		if (s.type === "tool_call") {
			step.tool = s.tool;
			try {
				step.params = s.params ? JSON.parse(s.params) : {};
			} catch {
				step.params = {};
			}
			if (s.permission) step.permission = s.permission;
		}
		if (s.type === "condition") {
			step.condition = s.condition || "true";
			// biome-ignore lint/suspicious/noThenProperty: workflow conditional branches
			step.then = [];
			step.else = [];
		}
		if (s.type === "delay") {
			step.delayMs = Number(s.delayMs) || 1000;
		}
		return step;
	});
}

function stepsFromApi(steps) {
	if (!Array.isArray(steps)) return [newStep()];
	return steps.map((s) => ({
		id: s.id || "",
		type: s.type || "tool_call",
		tool: s.tool || "search_contacts",
		params:
			typeof s.params === "string"
				? s.params
				: JSON.stringify(s.params || {}, null, 2),
		condition: s.condition || "",
		permission: s.permission || "",
		delayMs: String(s.delayMs ?? 1000),
		description: s.description || "",
	}));
}

export default function AiWorkflowsPage() {
	const [workflows, setWorkflows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [running, setRunning] = useState(false);
	const [message, setMessage] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [trigger, setTrigger] = useState("manual");
	const [eventName, setEventName] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [steps, setSteps] = useState([newStep()]);
	const [runResult, setRunResult] = useState(null);
	const [showEditor, setShowEditor] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/ai/workflows");
			const json = await res.json();
			setWorkflows(json.data || []);
		} catch {
			setMessage({ type: "error", text: "Failed to load workflows" });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const resetEditor = useCallback(() => {
		setEditingId(null);
		setName("");
		setDescription("");
		setTrigger("manual");
		setEventName("");
		setEnabled(true);
		setSteps([newStep()]);
		setRunResult(null);
	}, []);

	const openNew = useCallback(() => {
		resetEditor();
		setShowEditor(true);
	}, [resetEditor]);

	const openEdit = useCallback((wf) => {
		setEditingId(wf.id);
		setName(wf.name || "");
		setDescription(wf.description || "");
		setTrigger(wf.trigger || "manual");
		setEventName(wf.eventName || "");
		setEnabled(wf.enabled !== false);
		setSteps(stepsFromApi(wf.steps));
		setRunResult(wf.lastResult || null);
		setShowEditor(true);
	}, []);

	const updateStep = useCallback((index, patch) => {
		setSteps((prev) =>
			prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
		);
	}, []);

	const removeStep = useCallback((index) => {
		setSteps((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const addStep = useCallback(() => {
		setSteps((prev) => [...prev, newStep()]);
	}, []);

	const payload = useMemo(
		() => ({
			name: name.trim(),
			description: description.trim() || undefined,
			trigger,
			eventName:
				trigger === "event" ? eventName.trim() || undefined : undefined,
			enabled,
			steps: stepsToApi(steps),
		}),
		[name, description, trigger, eventName, enabled, steps],
	);

	const save = useCallback(async () => {
		if (!payload.name) {
			setMessage({ type: "error", text: "Name is required" });
			return;
		}
		setSaving(true);
		setMessage(null);
		try {
			const res = await fetch("/api/ai/workflows", {
				method: editingId ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					editingId ? { id: editingId, ...payload } : payload,
				),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				setMessage({
					type: "error",
					text: err.error || "Failed to save workflow",
				});
				return;
			}
			const json = await res.json();
			setMessage({ type: "success", text: "Workflow saved" });
			setEditingId(json.data.id);
			await load();
			setTimeout(() => setMessage(null), 3000);
		} catch (error) {
			setMessage({
				type: "error",
				text: error.message || "Failed to save workflow",
			});
		} finally {
			setSaving(false);
		}
	}, [editingId, payload, load]);

	const remove = useCallback(
		async (id) => {
			if (!confirm("Delete this workflow?")) return;
			try {
				const res = await fetch(
					`/api/ai/workflows?id=${encodeURIComponent(id)}`,
					{
						method: "DELETE",
					},
				);
				if (!res.ok) {
					setMessage({ type: "error", text: "Failed to delete workflow" });
					return;
				}
				if (editingId === id) {
					resetEditor();
					setShowEditor(false);
				}
				await load();
				setMessage({ type: "success", text: "Workflow deleted" });
				setTimeout(() => setMessage(null), 3000);
			} catch {
				setMessage({ type: "error", text: "Failed to delete workflow" });
			}
		},
		[editingId, load, resetEditor],
	);

	const runDry = useCallback(async () => {
		if (!payload.name) {
			setMessage({ type: "error", text: "Name is required to run" });
			return;
		}
		setRunning(true);
		setMessage(null);
		try {
			const res = await fetch("/api/ai/workflows", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workflowId: editingId || undefined,
					workflow: payload,
				}),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				setMessage({
					type: "error",
					text: err.error || "Failed to run workflow",
				});
				return;
			}
			const json = await res.json();
			setRunResult(json.data);
			setMessage({ type: "success", text: "Dry-run completed" });
			if (editingId) await load();
			setTimeout(() => setMessage(null), 3000);
		} catch (error) {
			setMessage({
				type: "error",
				text: error.message || "Failed to run workflow",
			});
		} finally {
			setRunning(false);
		}
	}, [editingId, payload, load]);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto">
			<div className="mb-6 flex items-start justify-between gap-4">
				<div>
					<h1 className="text-xl font-semibold text-text">AI Workflows</h1>
					<p className="text-sm text-text-muted mt-1">
						Define multi-step AI tool workflows with conditions, approvals, and
						delays. Dry-run validates structure without side effects.
					</p>
				</div>
				<button
					type="button"
					onClick={openNew}
					className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shrink-0"
				>
					New Workflow
				</button>
			</div>

			{message && (
				<div
					className={`mb-4 px-4 py-3 rounded-lg text-sm ${
						message.type === "success"
							? "bg-success-muted border border-success/30 text-success"
							: "bg-danger-muted border border-danger/30 text-danger"
					}`}
				>
					{message.text}
				</div>
			)}

			<div className="space-y-2 mb-8">
				{workflows.length === 0 ? (
					<div className="p-6 bg-surface border border-border rounded-lg text-sm text-text-muted text-center">
						No workflows yet. Create one to get started.
					</div>
				) : (
					workflows.map((wf) => (
						<div
							key={wf.id}
							className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg gap-3"
						>
							<button
								type="button"
								onClick={() => openEdit(wf)}
								className="flex-1 min-w-0 text-left"
							>
								<p className="text-sm font-medium text-text">{wf.name}</p>
								<p className="text-xs text-text-muted mt-0.5">
									{wf.description || "No description"} · {wf.trigger}
									{Array.isArray(wf.steps) ? ` · ${wf.steps.length} steps` : ""}
									{wf.lastRunAt
										? ` · last run ${new Date(wf.lastRunAt).toLocaleString()}`
										: ""}
								</p>
							</button>
							<div className="flex items-center gap-2 shrink-0">
								<span
									className={`px-2 py-0.5 text-xs rounded-md ${
										wf.enabled
											? "bg-success-muted text-success"
											: "bg-surface-hover text-text-muted"
									}`}
								>
									{wf.enabled ? "Enabled" : "Disabled"}
								</span>
								<button
									type="button"
									onClick={() => remove(wf.id)}
									className="px-2 py-1 text-xs text-danger hover:bg-danger-muted rounded-md transition-colors"
								>
									Delete
								</button>
							</div>
						</div>
					))
				)}
			</div>

			{showEditor && (
				<div className="border border-border rounded-lg bg-surface p-5 space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="text-base font-semibold text-text">
							{editingId ? "Edit Workflow" : "New Workflow"}
						</h2>
						<button
							type="button"
							onClick={() => {
								setShowEditor(false);
								resetEditor();
							}}
							className="text-xs text-text-muted hover:text-text"
						>
							Close
						</button>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<label className="block sm:col-span-2">
							<span className="text-xs font-medium text-text-muted">Name</span>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
								placeholder="e.g. Qualify inbound lead"
							/>
						</label>
						<label className="block sm:col-span-2">
							<span className="text-xs font-medium text-text-muted">
								Description
							</span>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={2}
								className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
								placeholder="What does this workflow do?"
							/>
						</label>
						<label className="block">
							<span className="text-xs font-medium text-text-muted">
								Trigger
							</span>
							<select
								value={trigger}
								onChange={(e) => setTrigger(e.target.value)}
								className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
							>
								<option value="manual">Manual</option>
								<option value="event">Event</option>
							</select>
						</label>
						{trigger === "event" ? (
							<label className="block">
								<span className="text-xs font-medium text-text-muted">
									Event name
								</span>
								<input
									type="text"
									value={eventName}
									onChange={(e) => setEventName(e.target.value)}
									className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
									placeholder="deal.created"
								/>
							</label>
						) : (
							<label className="flex items-center gap-2 mt-6">
								<input
									type="checkbox"
									checked={enabled}
									onChange={(e) => setEnabled(e.target.checked)}
								/>
								<span className="text-sm text-text">Enabled</span>
							</label>
						)}
					</div>

					<div>
						<div className="flex items-center justify-between mb-2">
							<h3 className="text-sm font-medium text-text">Steps</h3>
							<button
								type="button"
								onClick={addStep}
								className="text-xs text-primary hover:underline"
							>
								+ Add step
							</button>
						</div>
						<div className="space-y-3">
							{steps.map((step, index) => (
								<div
									key={step.id || index}
									className="p-3 border border-border rounded-md bg-background space-y-2"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="text-xs font-medium text-text-muted">
											Step {index + 1}
										</span>
										<button
											type="button"
											onClick={() => removeStep(index)}
											disabled={steps.length <= 1}
											className="text-xs text-danger disabled:opacity-40"
										>
											Remove
										</button>
									</div>
									<div className="grid gap-2 sm:grid-cols-2">
										<label className="block">
											<span className="text-xs text-text-muted">ID</span>
											<input
												type="text"
												value={step.id}
												onChange={(e) =>
													updateStep(index, { id: e.target.value })
												}
												className="mt-1 w-full px-2 py-1.5 text-sm bg-surface border border-border rounded-md text-text"
											/>
										</label>
										<label className="block">
											<span className="text-xs text-text-muted">Type</span>
											<select
												value={step.type}
												onChange={(e) =>
													updateStep(index, { type: e.target.value })
												}
												className="mt-1 w-full px-2 py-1.5 text-sm bg-surface border border-border rounded-md text-text"
											>
												{STEP_TYPES.map((t) => (
													<option key={t.value} value={t.value}>
														{t.label}
													</option>
												))}
											</select>
										</label>
										{step.type === "tool_call" && (
											<>
												<label className="block">
													<span className="text-xs text-text-muted">Tool</span>
													<select
														value={step.tool}
														onChange={(e) =>
															updateStep(index, { tool: e.target.value })
														}
														className="mt-1 w-full px-2 py-1.5 text-sm bg-surface border border-border rounded-md text-text"
													>
														{TOOL_OPTIONS.map((t) => (
															<option key={t} value={t}>
																{t}
															</option>
														))}
													</select>
												</label>
												<label className="block">
													<span className="text-xs text-text-muted">
														Permission override
													</span>
													<select
														value={step.permission}
														onChange={(e) =>
															updateStep(index, { permission: e.target.value })
														}
														className="mt-1 w-full px-2 py-1.5 text-sm bg-surface border border-border rounded-md text-text"
													>
														<option value="">User default</option>
														<option value="auto">Auto</option>
														<option value="confirm">Confirm</option>
														<option value="disabled">Disabled</option>
													</select>
												</label>
												<label className="block sm:col-span-2">
													<span className="text-xs text-text-muted">
														Params (JSON)
													</span>
													<textarea
														value={step.params}
														onChange={(e) =>
															updateStep(index, { params: e.target.value })
														}
														rows={3}
														className="mt-1 w-full px-2 py-1.5 text-sm font-mono bg-surface border border-border rounded-md text-text"
													/>
												</label>
											</>
										)}
										{step.type === "condition" && (
											<label className="block sm:col-span-2">
												<span className="text-xs text-text-muted">
													Condition expression
												</span>
												<input
													type="text"
													value={step.condition}
													onChange={(e) =>
														updateStep(index, { condition: e.target.value })
													}
													placeholder='steps.s1.status === "completed"'
													className="mt-1 w-full px-2 py-1.5 text-sm font-mono bg-surface border border-border rounded-md text-text"
												/>
											</label>
										)}
										{step.type === "delay" && (
											<label className="block">
												<span className="text-xs text-text-muted">
													Delay (ms)
												</span>
												<input
													type="number"
													value={step.delayMs}
													onChange={(e) =>
														updateStep(index, { delayMs: e.target.value })
													}
													className="mt-1 w-full px-2 py-1.5 text-sm bg-surface border border-border rounded-md text-text"
												/>
											</label>
										)}
										<label className="block sm:col-span-2">
											<span className="text-xs text-text-muted">
												Description
											</span>
											<input
												type="text"
												value={step.description}
												onChange={(e) =>
													updateStep(index, { description: e.target.value })
												}
												className="mt-1 w-full px-2 py-1.5 text-sm bg-surface border border-border rounded-md text-text"
											/>
										</label>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-3 pt-2">
						<button
							type="button"
							onClick={save}
							disabled={saving}
							className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
						>
							{saving ? "Saving..." : "Save Workflow"}
						</button>
						<button
							type="button"
							onClick={runDry}
							disabled={running}
							className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-text hover:bg-surface-hover disabled:opacity-50 transition-colors"
						>
							{running ? "Running..." : "Dry Run"}
						</button>
					</div>

					{runResult && (
						<div className="mt-2 p-4 border border-border rounded-md bg-background">
							<h3 className="text-sm font-medium text-text mb-2">
								Run history / last result
							</h3>
							<pre className="text-xs text-text-muted overflow-auto max-h-64 whitespace-pre-wrap">
								{JSON.stringify(runResult, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
