"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const ACCESS_LEVELS = [
	{ value: "auto", label: "Auto", description: "AI can use freely" },
	{
		value: "confirm",
		label: "Confirm",
		description: "AI proposes, you approve",
	},
	{ value: "disabled", label: "Disabled", description: "AI cannot use" },
];

const DEFAULT_CRM_LABELS = {
	entityLabel: "Deal",
	entityPluralLabel: "Deals",
	containerLabel: "Company",
	containerPluralLabel: "Companies",
	actorLabel: "Contact",
	actorPluralLabel: "Contacts",
};

/**
 * Build display labels/descriptions for tools using CRM config labels.
 * Tool names stay technical identifiers; only UI copy is dynamic.
 * @param {typeof DEFAULT_CRM_LABELS} crm
 */
function buildToolMeta(crm) {
	const {
		entityLabel,
		entityPluralLabel,
		containerLabel,
		containerPluralLabel,
		actorLabel,
		actorPluralLabel,
	} = crm;

	return {
		search_contacts: {
			label: `Search ${actorPluralLabel}`,
			description: `Search ${actorPluralLabel.toLowerCase()} by name, email, or ${containerLabel.toLowerCase()}`,
		},
		create_contact: {
			label: `Create ${actorLabel}`,
			description: `Create a new ${actorLabel.toLowerCase()} in the CRM`,
		},
		update_contact: {
			label: `Update ${actorLabel}`,
			description: `Update an existing ${actorLabel.toLowerCase()}'s information`,
		},
		search_companies: {
			label: `Search ${containerPluralLabel}`,
			description: `Search ${containerPluralLabel.toLowerCase()} by name, website, or industry`,
		},
		create_company: {
			label: `Create ${containerLabel}`,
			description: `Create a new ${containerLabel.toLowerCase()} record`,
		},
		update_company: {
			label: `Update ${containerLabel}`,
			description: `Update an existing ${containerLabel.toLowerCase()}'s information`,
		},
		search_deals: {
			label: `Search ${entityPluralLabel}`,
			description: `Search ${entityPluralLabel.toLowerCase()} by title, stage, ${containerLabel.toLowerCase()}, or ${actorLabel.toLowerCase()}`,
		},
		create_deal: {
			label: `Create ${entityLabel}`,
			description: `Create a new ${entityLabel.toLowerCase()} in the sales pipeline`,
		},
		update_deal: {
			label: `Update ${entityLabel}`,
			description: `Update an existing ${entityLabel.toLowerCase()}'s information`,
		},
		get_conversation_history: {
			label: "Get Conversation History",
			description: "Retrieve conversation message history",
		},
		get_context: {
			label: "Get Context",
			description: "Retrieve context records by category",
		},
		create_context: {
			label: "Create Context",
			description: "Create a new context record",
		},
		update_context: {
			label: "Update Context",
			description: "Update an existing context record",
		},
		delete_context: {
			label: "Delete Context",
			description: "Delete a context record",
		},
		search_context: {
			label: "Search Context",
			description: "Search context records by key or value",
		},
		search_jobs: {
			label: "Search Jobs",
			description: "Search background jobs by name, status, or queue",
		},
		web_search: {
			label: "Web Search",
			description: "Search the web for current information",
		},
	};
}

const DEFAULT_ACCESS = "auto";

export default function AiSettingsTab() {
	const [permissions, setPermissions] = useState({});
	const [crmLabels, setCrmLabels] = useState(DEFAULT_CRM_LABELS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState(null);
	const [changed, setChanged] = useState(false);

	useEffect(() => {
		Promise.all([
			fetch("/api/ai/tool-permissions").then((r) => r.json()),
			fetch("/api/admin/crm/config")
				.then((r) => (r.ok ? r.json() : null))
				.catch(() => null),
		])
			.then(([permsRes, crmRes]) => {
				const map = {};
				for (const p of permsRes.data || []) {
					map[p.toolName] = p.accessLevel;
				}
				setPermissions(map);

				if (crmRes?.data) {
					setCrmLabels({
						entityLabel:
							crmRes.data.entityLabel ?? DEFAULT_CRM_LABELS.entityLabel,
						entityPluralLabel:
							crmRes.data.entityPluralLabel ??
							DEFAULT_CRM_LABELS.entityPluralLabel,
						containerLabel:
							crmRes.data.containerLabel ?? DEFAULT_CRM_LABELS.containerLabel,
						containerPluralLabel:
							crmRes.data.containerPluralLabel ??
							DEFAULT_CRM_LABELS.containerPluralLabel,
						actorLabel: crmRes.data.actorLabel ?? DEFAULT_CRM_LABELS.actorLabel,
						actorPluralLabel:
							crmRes.data.actorPluralLabel ??
							DEFAULT_CRM_LABELS.actorPluralLabel,
					});
				}

				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
				setMessage({ type: "error", text: "Failed to load permissions" });
			});
	}, []);

	const toolMeta = useMemo(() => buildToolMeta(crmLabels), [crmLabels]);

	const setAccess = useCallback((toolName, level) => {
		setPermissions((prev) => ({ ...prev, [toolName]: level }));
		setChanged(true);
	}, []);

	const save = useCallback(async () => {
		setSaving(true);
		setMessage(null);
		try {
			const perms = Object.entries(permissions).map(
				([toolName, accessLevel]) => ({
					toolName,
					accessLevel,
				}),
			);
			const res = await fetch("/api/ai/tool-permissions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ permissions: perms }),
			});
			if (!res.ok) throw new Error("Save failed");
			setMessage({ type: "success", text: "Permissions saved" });
			setChanged(false);
			setTimeout(() => setMessage(null), 3000);
		} catch {
			setMessage({ type: "error", text: "Failed to save permissions" });
		} finally {
			setSaving(false);
		}
	}, [permissions]);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	return (
		<div className="max-w-3xl mx-auto">
			<div className="mb-6">
				<h2 className="text-xl font-semibold text-text">AI Tool Permissions</h2>
				<p className="text-sm text-text-muted mt-1">
					Control how the AI assistant can use each tool. Changes apply to new
					conversations.
				</p>
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

			<div className="space-y-2">
				{Object.keys(toolMeta).map((toolName) => {
					const current = permissions[toolName] || DEFAULT_ACCESS;
					const meta = toolMeta[toolName];
					return (
						<div
							key={toolName}
							className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg"
						>
							<div className="flex-1 min-w-0 mr-4">
								<p className="text-sm font-medium text-text">{meta.label}</p>
								<p className="text-xs text-text-muted mt-0.5">
									{meta.description}
								</p>
							</div>
							<div className="flex gap-1 shrink-0">
								{ACCESS_LEVELS.map((level) => (
									<button
										key={level.value}
										type="button"
										onClick={() => setAccess(toolName, level.value)}
										className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
											current === level.value
												? level.value === "auto"
													? "bg-primary text-white"
													: level.value === "confirm"
														? "bg-warning-muted text-warning border border-warning/30"
														: "bg-danger-muted text-danger border border-danger/30"
												: "bg-surface-hover text-text-muted hover:text-text border border-transparent"
										}`}
									>
										{level.label}
									</button>
								))}
							</div>
						</div>
					);
				})}
			</div>

			<div className="mt-6 flex items-center gap-3">
				<button
					type="button"
					onClick={save}
					disabled={saving || !changed}
					className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{saving ? "Saving..." : "Save Changes"}
				</button>
				{changed && (
					<span className="text-xs text-text-muted">
						You have unsaved changes
					</span>
				)}
			</div>
		</div>
	);
}
