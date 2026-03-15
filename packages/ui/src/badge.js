import React from "react";

const base =
	"inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-medium tracking-wide";

const THEMES = {
	light: {
		default: "border-gray-200 bg-gray-100 text-gray-800",
		success: "border-green-200 bg-green-100 text-green-800",
		warning: "border-yellow-200 bg-yellow-100 text-yellow-800",
		danger: "border-red-200 bg-red-100 text-red-800",
		info: "border-blue-200 bg-blue-100 text-blue-800",
	},
	dark: {
		default: "border-[#1e2535] bg-[#1e2535]/50 text-[#6b7a99]",
		success: "border-emerald-800/50 bg-emerald-900/20 text-emerald-400",
		warning: "border-yellow-800/50 bg-yellow-900/20 text-yellow-400",
		danger: "border-[#ff4757]/30 bg-[#ff4757]/10 text-[#ff4757]",
		info: "border-[#377dff]/30 bg-[#377dff]/10 text-[#377dff]",
	},
};

export function Badge({
	variant = "default",
	theme = "light",
	className = "",
	...props
}) {
	const t = THEMES[theme] ?? THEMES.light;
	const cls = `${base} ${t[variant] ?? t.default} ${className}`.trim();
	return React.createElement("span", { className: cls, ...props });
}
