"use client";

const TOOL_LABELS = {
	search_contacts: "Search Contacts",
	create_contact: "Create Contact",
	update_contact: "Update Contact",
	search_companies: "Search Companies",
	create_company: "Create Company",
	update_company: "Update Company",
	search_deals: "Search Deals",
	create_deal: "Create Deal",
	update_deal: "Update Deal",
	get_conversation_history: "Get Conversation History",
	get_context: "Get Context",
	create_context: "Create Context",
	update_context: "Update Context",
	delete_context: "Delete Context",
	search_context: "Search Context",
	search_jobs: "Search Jobs",
	web_search: "Web Search",
};

function summarizeInput(input) {
	if (!input || typeof input !== "object") return "No parameters";

	const entries = Object.entries(input).filter(
		([, value]) => value !== undefined && value !== null && value !== "",
	);
	if (entries.length === 0) return "No parameters";

	return entries
		.slice(0, 6)
		.map(([key, value]) => {
			const display =
				typeof value === "object" ? JSON.stringify(value) : String(value);
			const truncated =
				display.length > 80 ? `${display.slice(0, 77)}...` : display;
			return `${key}: ${truncated}`;
		})
		.join(" · ");
}

export default function ToolProposalCard({ proposal, onApprove, onDeny }) {
	if (!proposal) return null;

	const label =
		TOOL_LABELS[proposal.toolName] ||
		proposal.toolName?.replaceAll("_", " ") ||
		"Unknown tool";

	return (
		<div
			className="rounded-lg border border-warning/30 bg-warning-muted px-4 py-3 shadow-sm"
			role="alertdialog"
			aria-labelledby="tool-proposal-title"
			aria-describedby="tool-proposal-summary"
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
					<svg
						aria-hidden="true"
						className="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
				</div>
				<div className="min-w-0 flex-1">
					<p id="tool-proposal-title" className="text-sm font-medium text-text">
						Approve tool: {label}
					</p>
					<p
						id="tool-proposal-summary"
						className="mt-1 text-xs text-text-muted break-words"
					>
						{summarizeInput(proposal.input)}
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<button
							type="button"
							onClick={onApprove}
							className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
						>
							Approve
						</button>
						<button
							type="button"
							onClick={onDeny}
							className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
						>
							Deny
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
