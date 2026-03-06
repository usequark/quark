import React from "react";

const inputBase =
	"h-4 w-4 rounded border-gray-300 text-blue-600 shadow-sm transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60";
const labelBase = "text-sm text-gray-700 select-none";

export function Checkbox({ id, label, className = "", ...props }) {
	return React.createElement(
		"div",
		{ className: "flex items-center gap-2" },
		React.createElement("input", {
			id,
			type: "checkbox",
			className: `${inputBase} ${className}`.trim(),
			...props,
		}),
		React.createElement("label", { htmlFor: id, className: labelBase }, label),
	);
}
