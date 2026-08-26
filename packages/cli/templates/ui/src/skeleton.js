import React from "react";

const base = "animate-pulse bg-[--skeleton-bg]";

export function Skeleton({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${base} ${className}`.trim(),
		style: { borderRadius: "var(--skeleton-radius)" },
		...props,
	});
}
