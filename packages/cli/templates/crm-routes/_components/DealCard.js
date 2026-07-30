"use client";

import { formatCurrency } from "@techstream/quark-crm";
import Link from "next/link";
import { useTransition } from "react";

export default function DealCard({ deal, transitions, onMove }) {
	const [pending, startTransition] = useTransition();

	return (
		<div
			className={`border border-border bg-surface p-3 rounded-sm ${pending ? "opacity-50" : ""}`}
		>
			<div className="flex items-start justify-between mb-2">
				<Link
					href={`/admin/deal/${deal.id}`}
					className="text-sm font-medium text-text hover:text-primary truncate"
				>
					{deal.title}
				</Link>
			</div>

			{deal.contact && (
				<p className="text-xs text-text-faint truncate">
					{deal.contact.firstName} {deal.contact.lastName}
				</p>
			)}
			{deal.company && (
				<p className="text-xs text-text-faint truncate">{deal.company.name}</p>
			)}

			<div className="mt-2 flex items-center justify-between">
				<span className="text-sm font-semibold tabular-nums text-text">
					{formatCurrency(Number(deal.value))}
				</span>
				<span className="text-xs text-text-faint">{deal.probability}%</span>
			</div>

			{transitions.length > 0 && (
				<div className="mt-3 flex flex-wrap items-center gap-1">
					{transitions.map((t) => (
						<button
							key={t.key}
							type="button"
							disabled={pending}
							onClick={() => startTransition(() => onMove(deal.id, t.key))}
							className="flex-1 text-xs py-1 border border-border bg-bg hover:bg-surface-hover text-text-muted disabled:opacity-50 transition-colors"
						>
							{t.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
