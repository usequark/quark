import React from "react";

const base =
	"inline-flex items-center border px-2.5 py-0.5 text-xs font-medium uppercase tracking-widest";

const VARIANTS = {
	default: "border-border bg-surface-hover text-text-muted",
	success: "border-success/40 bg-success-muted text-success",
	warning: "border-warning/40 bg-warning-muted text-warning",
	danger: "border-danger/40 bg-danger-muted text-danger",
	info: "border-info/40 bg-info-muted text-info",
};

export function Badge({ variant = "default", className = "", ...props }) {
	const cls =
		`${base} rounded-[--radius-default] ${VARIANTS[variant] ?? VARIANTS.default} ${className}`.trim();
	return React.createElement("span", { className: cls, ...props });
}
