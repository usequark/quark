"use client";

import { useEffect, useState } from "react";

const STATUS_COLORS = {
	ok: "#22c55e",
	degraded: "#f59e0b",
	error: "#ef4444",
};

function Dot({ status, label }) {
	const dotColor = STATUS_COLORS[status] ?? "var(--quark-health-dot-idle)";
	return (
		<span
			title={`${label}: ${status ?? "checking…"}`}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: "4px",
				color: "var(--quark-health-text)",
				fontFamily: "monospace",
				fontSize: "11px",
			}}
		>
			<span
				style={{
					display: "inline-block",
					width: "5px",
					height: "5px",
					borderRadius: "50%",
					backgroundColor: dotColor,
					transition: "background-color 0.3s ease",
					flexShrink: 0,
				}}
			/>
			{label}
		</span>
	);
}

/**
 * Fetches /api/health once on mount and renders small coloured dots for
 * database, Redis, and storage status. Shows neutral dots while loading.
 * Fails silently so the home page aesthetic is never disrupted.
 * Colours are driven by CSS custom properties (prefers-color-scheme aware).
 */
export default function HealthIndicator() {
	const [checks, setChecks] = useState(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/health")
			.then((r) => r.json())
			.then((data) => {
				if (!cancelled) setChecks(data.checks ?? {});
			})
			.catch(() => {
				if (!cancelled) setChecks({});
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "8px",
				fontFamily: "monospace",
				fontSize: "11px",
			}}
		>
			<Dot status={checks?.database?.status} label="db" />
			<span style={{ color: "var(--quark-health-sep)" }}>·</span>
			<Dot status={checks?.redis?.status} label="redis" />
			<span style={{ color: "var(--quark-health-sep)" }}>·</span>
			<Dot
				status={checks?.storage?.status}
				label={checks?.storage?.provider ?? "storage"}
			/>
		</div>
	);
}
