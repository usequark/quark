import React from "react";

const base =
	"inline-flex items-center justify-center rounded-sm font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:translate-y-px";

const THEMES = {
	light: {
		primary:
			"bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow focus-visible:ring-blue-500",
		secondary:
			"border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow focus-visible:ring-gray-400",
		danger:
			"bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow focus-visible:ring-red-500",
		ghost:
			"bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400",
		success:
			"bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow focus-visible:ring-emerald-500",
		warning:
			"bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow focus-visible:ring-amber-400",
		info: "bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 hover:shadow focus-visible:ring-cyan-500",
		outline:
			"border border-blue-600 text-blue-600 bg-transparent hover:bg-blue-50 focus-visible:ring-blue-500",
		solid:
			"bg-blue-700 text-white shadow-sm hover:bg-blue-800 hover:shadow focus-visible:ring-blue-600",
	},
	dark: {
		primary:
			"bg-[#377dff]/10 border border-[#377dff]/40 text-[#377dff] hover:bg-[#377dff]/20 hover:border-[#377dff]/80 focus-visible:ring-[#377dff]/40 focus-visible:ring-offset-0",
		secondary:
			"border border-[#1e2535] text-[#6b7a99] hover:border-[#377dff]/30 hover:text-[#e0e0e0] focus-visible:ring-[#377dff]/30 focus-visible:ring-offset-0",
		danger:
			"bg-[#ff4757]/10 border border-[#ff4757]/40 text-[#ff4757] hover:bg-[#ff4757]/20 hover:border-[#ff4757]/80 focus-visible:ring-[#ff4757]/40 focus-visible:ring-offset-0",
		ghost:
			"text-[#4a4a6a] hover:bg-[#1e2535] hover:text-[#e0e0e0] focus-visible:ring-[#377dff]/30 focus-visible:ring-offset-0",
		success:
			"bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/80 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-0",
		warning:
			"bg-amber-500/10 border border-amber-400/40 text-amber-400 hover:bg-amber-500/20 hover:border-amber-400/80 focus-visible:ring-amber-400/40 focus-visible:ring-offset-0",
		info: "bg-cyan-500/10 border border-cyan-400/40 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400/80 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-0",
		outline:
			"border border-[#377dff]/60 text-[#377dff] bg-transparent hover:bg-[#377dff]/10 focus-visible:ring-[#377dff]/40 focus-visible:ring-offset-0",
		solid:
			"bg-[#377dff] text-white hover:bg-[#2563eb] focus-visible:ring-[#377dff]/60 focus-visible:ring-offset-0",
	},
};

const sizes = {
	sm: "h-8 px-3 text-sm",
	md: "h-10 px-4 text-sm",
	lg: "h-11 px-6 text-base",
};

export function Button({
	variant = "primary",
	size = "md",
	theme = "light",
	className = "",
	...props
}) {
	const t = THEMES[theme] ?? THEMES.light;
	const cls =
		`${base} ${t[variant] ?? t.primary} ${sizes[size] ?? sizes.md} ${className}`.trim();
	return React.createElement("button", {
		type: "button",
		className: cls,
		...props,
	});
}
