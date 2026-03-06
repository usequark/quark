import React from "react";

const base =
	"inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:translate-y-px";

const variants = {
	primary:
		"bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow focus-visible:ring-blue-500",
	secondary:
		"border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow focus-visible:ring-gray-400",
	danger:
		"bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow focus-visible:ring-red-500",
	ghost:
		"bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400",
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
		`${base} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${className}`.trim();
	return React.createElement("button", {
		type: "button",
		className: cls,
		...props,
	});
}
