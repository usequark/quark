import React from "react";

const THEMES = {
	light: {
		input:
			"h-4 w-4 rounded border-gray-300 text-blue-600 shadow-sm transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60",
		label: "text-sm text-gray-700 select-none",
	},
	dark: {
		input:
			"h-4 w-4 rounded border-[#1e2535] bg-[#090d14] accent-[#377dff] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#377dff]/40 disabled:cursor-not-allowed disabled:opacity-40",
		label: "text-sm text-[#6b7a99] font-mono select-none",
	},
};

export function Checkbox({
	id,
	label,
	theme = "light",
	className = "",
	...props
}) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement(
		"div",
		{ className: "flex items-center gap-2" },
		React.createElement("input", {
			id,
			type: "checkbox",
			className: `${t.input} ${className}`.trim(),
			...props,
		}),
		React.createElement("label", { htmlFor: id, className: t.label }, label),
	);
}
