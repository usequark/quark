import React from "react";

const base =
	"block w-full rounded-[--radius-default] border border-border bg-surface-hover px-3 py-2 text-sm text-text placeholder-text-faint transition-colors duration-200 hover:border-border-hover focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-30 disabled:cursor-not-allowed resize-y";

export function Textarea({ className = "", ...props }) {
	return React.createElement("textarea", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
