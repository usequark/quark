import React from "react";

const base = "block text-sm font-medium text-gray-700 tracking-tight";

export function Label({ className = "", ...props }) {
	return React.createElement("label", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
