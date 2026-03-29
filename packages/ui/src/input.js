import React from "react";

const base =
	"block h-10 w-full border border-border bg-surface px-3 text-sm text-text placeholder-text-faint transition-colors duration-200 linear hover:border-border-hover focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-30 disabled:cursor-not-allowed";

export function Input({ className = "", ...props }) {
	return React.createElement("input", {
		className: `${base} rounded-[--radius-default] ${className}`.trim(),
		...props,
	});
}
