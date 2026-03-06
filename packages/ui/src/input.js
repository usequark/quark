import React from "react";

const base =
	"block h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 hover:border-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";

export function Input({ className = "", ...props }) {
	return React.createElement("input", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
