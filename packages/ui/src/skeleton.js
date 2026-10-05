import React from "react";

const base = "animate-pulse rounded-lg bg-(--skeleton-bg)";

export function Skeleton({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
