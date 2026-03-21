import React from "react";

const base =
	"inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-medium tracking-wide";

const VARIANTS = {
	default:
		"border-gray-200 dark:border-[#1e2535] bg-gray-100 dark:bg-[#1e2535]/50 text-gray-800 dark:text-[#6b7a99]",
	success:
		"border-green-200 dark:border-emerald-800/50 bg-green-100 dark:bg-emerald-900/20 text-green-800 dark:text-emerald-400",
	warning:
		"border-yellow-200 dark:border-yellow-800/50 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400",
	danger:
		"border-red-200 dark:border-[#ff4757]/30 bg-red-100 dark:bg-[#ff4757]/10 text-red-800 dark:text-[#ff4757]",
	info: "border-blue-200 dark:border-[#377dff]/30 bg-blue-100 dark:bg-[#377dff]/10 text-blue-800 dark:text-[#377dff]",
};

export function Badge({ variant = "default", className = "", ...props }) {
	const cls =
		`${base} ${VARIANTS[variant] ?? VARIANTS.default} ${className}`.trim();
	return React.createElement("span", { className: cls, ...props });
}
