import React from "react";

const cardCls =
	"rounded border border-gray-200 dark:border-[#1e2535] bg-white/95 dark:bg-[#0d1117] shadow-sm dark:shadow-none transition-shadow dark:transition-all duration-200 hover:shadow-md dark:hover:shadow-none dark:hover:border-[#377dff]/30";

const headerCls = "flex flex-col space-y-1.5 p-6";

const titleCls =
	"text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-[#e0e0e0]";

const contentCls = "p-6 pt-0";

const footerCls = "flex items-center p-6 pt-0";

export function Card({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${cardCls} ${className}`.trim(),
		...props,
	});
}

export function CardHeader({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${headerCls} ${className}`.trim(),
		...props,
	});
}

export function CardTitle({ className = "", ...props }) {
	return React.createElement("h3", {
		className: `${titleCls} ${className}`.trim(),
		...props,
	});
}

export function CardContent({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${contentCls} ${className}`.trim(),
		...props,
	});
}

export function CardFooter({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${footerCls} ${className}`.trim(),
		...props,
	});
}
