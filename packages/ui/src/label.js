import React from "react";

const base =
	"block text-sm font-medium text-gray-700 dark:text-[#4a4a6a] tracking-tight dark:font-mono";

export function Label({ className = "", ...props }) {
	return React.createElement("label", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
