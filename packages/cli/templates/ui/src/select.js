import React from "react";

const selectCls =
	"block h-10 w-full appearance-none rounded-sm border border-gray-300 dark:border-[#1e2535] bg-white dark:bg-[#090d14] px-3 pr-9 text-sm text-gray-900 dark:text-[#e0e0e0] shadow-sm dark:shadow-none dark:font-mono transition-all duration-200 cursor-pointer hover:border-gray-400 dark:hover:border-[#377dff]/30 focus-visible:border-blue-500 dark:focus-visible:border-[#377dff]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:focus-visible:ring-[#377dff]/15 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-[#090d14] dark:disabled:text-[#e0e0e0] dark:disabled:opacity-30";

const chevronCls =
	"absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#4a4a6a] pointer-events-none";

export function Select({ className = "", children, ...props }) {
	return React.createElement(
		"div",
		{ className: "relative" },
		React.createElement(
			"select",
			{ className: `${selectCls} ${className}`.trim(), ...props },
			children,
		),
		React.createElement(
			"span",
			{
				"aria-hidden": "true",
				className: chevronCls,
			},
			"\u25be",
		),
	);
}
