import React from "react";

const inputCls =
	"h-4 w-4 rounded border-gray-300 dark:border-[#1e2535] text-blue-600 dark:bg-[#090d14] dark:accent-[#377dff] shadow-sm dark:shadow-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:focus-visible:ring-[#377dff]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:disabled:opacity-40";

const labelCls =
	"text-sm text-gray-700 dark:text-[#6b7a99] dark:font-mono select-none";

export function Checkbox({ id, label, className = "", ...props }) {
	return React.createElement(
		"div",
		{ className: "flex items-center gap-2" },
		React.createElement("input", {
			id,
			type: "checkbox",
			className: `${inputCls} ${className}`.trim(),
			...props,
		}),
		React.createElement("label", { htmlFor: id, className: labelCls }, label),
	);
}
