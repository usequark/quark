import React from "react";

const base = "block text-xs font-medium text-[--label-text]";

export function Label({ className = "", ...props }) {
	return React.createElement("label", {
		className: `${base} ${className}`.trim(),
		style: {
			textTransform: "var(--label-text-transform)",
			letterSpacing: "var(--label-text-tracking)",
		},
		...props,
	});
}
