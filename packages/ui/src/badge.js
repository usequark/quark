import React from "react";

const base =
	"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide";

const variants = {
	default: "border-gray-200 bg-gray-100 text-gray-800",
	success: "border-green-200 bg-green-100 text-green-800",
	warning: "border-yellow-200 bg-yellow-100 text-yellow-800",
	danger: "border-red-200 bg-red-100 text-red-800",
	info: "border-blue-200 bg-blue-100 text-blue-800",
};

export function Badge({ variant = "default", className = "", ...props }) {
	const cls =
		`${base} ${variants[variant] ?? variants.default} ${className}`.trim();
	return React.createElement("span", { className: cls, ...props });
}
