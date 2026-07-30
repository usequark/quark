"use client";

import { formatCurrency } from "@techstream/quark-crm";

export default function StageColumn({
	stage,
	count,
	totalValue,
	entityPluralLabel = "Deals",
	currencyOpts = {},
	children,
}) {
	const colorMap = {
		default: "bg-border",
		info: "bg-blue-500",
		primary: "bg-primary",
		warning: "bg-amber-500",
		success: "bg-green-500",
		danger: "bg-red-500",
	};

	return (
		<div className="flex flex-col border border-border bg-surface/50">
			<div className={`h-0.5 ${colorMap[stage.color] ?? "bg-border"}`} />
			<div className="px-3 py-2 border-b border-border">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
						{stage.label}
					</h3>
					<span className="text-xs text-text-faint tabular-nums">{count}</span>
				</div>
				<p className="text-xs text-text-faint tabular-nums mt-0.5">
					{formatCurrency(totalValue, currencyOpts)}
				</p>
			</div>
			<div className="flex-1 p-2 space-y-2 min-h-[200px] overflow-auto">
				{children}
				{count === 0 && (
					<p className="text-xs text-text-faint text-center py-4">
						No {entityPluralLabel.toLowerCase()}
					</p>
				)}
			</div>
		</div>
	);
}
