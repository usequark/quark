import React from "react";

const THEMES = {
	light:
		"block h-10 w-full rounded-sm border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 hover:border-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed",
	dark: "block h-10 w-full rounded-sm border border-[#1e2535] bg-[#090d14] px-3 text-sm text-[#e0e0e0] placeholder-[#2d3a52] font-mono transition-all duration-200 hover:border-[#377dff]/30 focus-visible:border-[#377dff]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#377dff]/15 disabled:opacity-30 disabled:cursor-not-allowed",
};

export function Input({ theme = "light", className = "", ...props }) {
	const base = THEMES[theme] ?? THEMES.light;
	return React.createElement("input", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
