import React from "react";

const base = "animate-pulse rounded-lg bg-gray-200/80";

export function Skeleton({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
