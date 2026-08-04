"use client";

import { useState } from "react";
import AiSettingsTab from "./AiSettingsTab";
import CrmSettingsTab from "./CrmSettingsTab";

/**
 * @param {{
 *   crmEnabled: boolean,
 *   initialTab?: string
 * }} props
 */
export default function SettingsTabs({ crmEnabled, initialTab }) {
	const tabs = [
		...(crmEnabled ? [{ id: "crm", label: "CRM" }] : []),
		{ id: "ai", label: "AI" },
	];

	const validIds = tabs.map((t) => t.id);
	const defaultTab = validIds.includes(initialTab) ? initialTab : validIds[0];
	const [activeTab, setActiveTab] = useState(defaultTab);

	return (
		<div className="max-w-3xl mx-auto">
			<div className="mb-6">
				<h1 className="text-xl font-semibold text-text">Settings</h1>
				<p className="text-sm text-text-muted mt-1">
					Configure CRM, AI tools, and other admin preferences.
				</p>
			</div>

			<div
				className="flex gap-1 border-b border-border mb-6"
				role="tablist"
				aria-label="Settings sections"
			>
				{tabs.map((tab) => {
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={isActive}
							id={`settings-tab-${tab.id}`}
							aria-controls={`settings-panel-${tab.id}`}
							onClick={() => setActiveTab(tab.id)}
							className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
								isActive
									? "border-primary text-text"
									: "border-transparent text-text-muted hover:text-text"
							}`}
						>
							{tab.label}
						</button>
					);
				})}
			</div>

			{activeTab === "crm" && crmEnabled && (
				<div
					role="tabpanel"
					id="settings-panel-crm"
					aria-labelledby="settings-tab-crm"
				>
					<CrmSettingsTab />
				</div>
			)}

			{activeTab === "ai" && (
				<div
					role="tabpanel"
					id="settings-panel-ai"
					aria-labelledby="settings-tab-ai"
				>
					<AiSettingsTab />
				</div>
			)}
		</div>
	);
}
