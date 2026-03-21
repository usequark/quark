import React from "react";

const base =
	"inline-flex items-center justify-center rounded-sm font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:translate-y-px";

const VARIANTS = {
	primary:
		"bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow focus-visible:ring-blue-500 dark:bg-[#377dff]/10 dark:border dark:border-[#377dff]/40 dark:text-[#377dff] dark:shadow-none dark:hover:bg-[#377dff]/20 dark:hover:border-[#377dff]/80 dark:hover:shadow-none dark:focus-visible:ring-[#377dff]/40",
	secondary:
		"border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow focus-visible:ring-gray-400 dark:border-[#1e2535] dark:bg-transparent dark:text-[#6b7a99] dark:shadow-none dark:hover:bg-transparent dark:hover:border-[#377dff]/30 dark:hover:text-[#e0e0e0] dark:hover:shadow-none dark:focus-visible:ring-[#377dff]/30",
	danger:
		"bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow focus-visible:ring-red-500 dark:bg-[#ff4757]/10 dark:border dark:border-[#ff4757]/40 dark:text-[#ff4757] dark:shadow-none dark:hover:bg-[#ff4757]/20 dark:hover:border-[#ff4757]/80 dark:hover:shadow-none dark:focus-visible:ring-[#ff4757]/40",
	ghost:
		"bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400 dark:text-[#4a4a6a] dark:hover:bg-[#1e2535] dark:hover:text-[#e0e0e0] dark:focus-visible:ring-[#377dff]/30",
	success:
		"bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow focus-visible:ring-emerald-500 dark:bg-emerald-500/10 dark:border dark:border-emerald-500/40 dark:text-emerald-400 dark:shadow-none dark:hover:bg-emerald-500/20 dark:hover:border-emerald-500/80 dark:hover:shadow-none dark:focus-visible:ring-emerald-400/40",
	warning:
		"bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow focus-visible:ring-amber-400 dark:bg-amber-500/10 dark:border dark:border-amber-400/40 dark:text-amber-400 dark:shadow-none dark:hover:bg-amber-500/20 dark:hover:border-amber-400/80 dark:hover:shadow-none dark:focus-visible:ring-amber-400/40",
	info: "bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 hover:shadow focus-visible:ring-cyan-500 dark:bg-cyan-500/10 dark:border dark:border-cyan-400/40 dark:text-cyan-400 dark:shadow-none dark:hover:bg-cyan-500/20 dark:hover:border-cyan-400/80 dark:hover:shadow-none dark:focus-visible:ring-cyan-400/40",
	outline:
		"border border-blue-600 text-blue-600 bg-transparent hover:bg-blue-50 focus-visible:ring-blue-500 dark:border-[#377dff]/60 dark:text-[#377dff] dark:hover:bg-[#377dff]/10 dark:focus-visible:ring-[#377dff]/40",
	solid:
		"bg-blue-700 text-white shadow-sm hover:bg-blue-800 hover:shadow focus-visible:ring-blue-600 dark:bg-[#377dff] dark:shadow-none dark:hover:bg-[#2563eb] dark:hover:shadow-none dark:focus-visible:ring-[#377dff]/60",
};

const sizes = {
	sm: "h-8 px-3 text-sm",
	md: "h-10 px-4 text-sm",
	lg: "h-11 px-6 text-base",
};

export function Button({
	variant = "primary",
	size = "md",
	className = "",
	...props
}) {
	const cls =
		`${base} ${VARIANTS[variant] ?? VARIANTS.primary} ${sizes[size] ?? sizes.md} ${className}`.trim();
	return React.createElement("button", {
		type: "button",
		className: cls,
		...props,
	});
}
