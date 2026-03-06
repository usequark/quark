import React from "react";

const selectBase =
	"block h-10 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pr-9 text-sm text-gray-900 shadow-sm transition-all duration-200 cursor-pointer hover:border-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";

export function Select({ className = "", children, ...props }) {
	return React.createElement(
		"div",
		{ className: "relative" },
		React.createElement(
			"select",
			{ className: `${selectBase} ${className}`.trim(), ...props },
			children,
		),
		React.createElement(
			"span",
			{
				"aria-hidden": "true",
				className:
					"absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none",
			},
			"\u25be",
		),
	);
}
