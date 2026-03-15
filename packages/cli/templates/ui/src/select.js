import React from "react";

const THEMES = {
	light: {
		select:
			"block h-10 w-full appearance-none rounded-sm border border-gray-300 bg-white px-3 pr-9 text-sm text-gray-900 shadow-sm transition-all duration-200 cursor-pointer hover:border-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed",
		chevron:
			"absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none",
	},
	dark: {
		select:
			"block h-10 w-full appearance-none rounded-sm border border-[#1e2535] bg-[#090d14] px-3 pr-9 text-sm text-[#e0e0e0] font-mono transition-all duration-200 cursor-pointer hover:border-[#377dff]/30 focus-visible:border-[#377dff]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#377dff]/15 disabled:opacity-30 disabled:cursor-not-allowed",
		chevron:
			"absolute right-3 top-1/2 -translate-y-1/2 text-[#4a4a6a] pointer-events-none",
	},
};

export function Select({
	theme = "light",
	className = "",
	children,
	...props
}) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement(
		"div",
		{ className: "relative" },
		React.createElement(
			"select",
			{ className: `${t.select} ${className}`.trim(), ...props },
			children,
		),
		React.createElement(
			"span",
			{
				"aria-hidden": "true",
				className: t.chevron,
			},
			"\u25be",
		),
	);
}
