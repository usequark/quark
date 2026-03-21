import React from "react";

const base =
	"block w-full rounded-sm border border-gray-300 dark:border-[#1e2535] bg-white dark:bg-[#090d14] px-3 py-2 text-sm text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#2d3a52] shadow-sm dark:shadow-none dark:font-mono transition-all duration-200 hover:border-gray-400 dark:hover:border-[#377dff]/30 focus-visible:border-blue-500 dark:focus-visible:border-[#377dff]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:focus-visible:ring-[#377dff]/15 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-[#090d14] dark:disabled:text-[#e0e0e0] dark:disabled:opacity-30 resize-y";

export function Textarea({ className = "", ...props }) {
	return React.createElement("textarea", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
