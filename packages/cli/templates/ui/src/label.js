import React from "react";

// Expert-designer spec: uppercase, expanded tracking, high-contrast
const base =
	"block text-xs font-medium uppercase tracking-widest text-[--label-text]";

export function Label({ className = "", ...props }) {
	return React.createElement("label", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
