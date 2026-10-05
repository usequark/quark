import React from "react";

const base =
	"inline-flex items-center justify-center border font-medium bg-(--badge-bg) border-(--badge-border) text-(--badge-text)";

export function Badge({ variant = "default", className = "", ...props }) {
	const cls = `${base} rounded-(--radius-default) ${className}`.trim();
	return React.createElement("span", {
		"data-badge-variant": variant,
		className: cls,
		style: {
			minWidth: "var(--badge-min-width)",
			paddingLeft: "var(--badge-padding-x)",
			paddingRight: "var(--badge-padding-x)",
			paddingTop: "var(--badge-padding-y)",
			paddingBottom: "var(--badge-padding-y)",
			fontSize: "var(--badge-font-size)",
			textTransform: "var(--badge-text-transform)",
			letterSpacing: "var(--badge-text-tracking)",
		},
		...props,
	});
}
