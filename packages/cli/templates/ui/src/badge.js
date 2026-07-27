import React from "react";

const base =
	"inline-flex items-center justify-center min-w-20 border px-2.5 py-0.5 text-xs font-medium uppercase tracking-widest bg-[--badge-bg] border-[--badge-border] text-[--badge-text]";

export function Badge({ variant = "default", className = "", ...props }) {
	const cls = `${base} rounded-[--radius-default] ${className}`.trim();
	return React.createElement("span", {
		"data-badge-variant": variant,
		className: cls,
		...props,
	});
}
