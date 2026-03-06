import React from "react";

const base =
	"block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 hover:border-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed resize-y";

export function Textarea({ className = "", ...props }) {
	return React.createElement("textarea", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
