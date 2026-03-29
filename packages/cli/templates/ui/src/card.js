import React from "react";

const cardCls =
	"border border-border bg-surface transition-colors duration-200 linear";

const headerCls = "flex flex-col space-y-1.5 p-6";

const titleCls = "text-lg font-bold leading-none tracking-tight text-text";

const contentCls = "p-6 pt-0";

const footerCls = "flex items-center p-6 pt-0";

export function Card({ className = "", ...props }) {
	return React.createElement("div", {
		className: `${cardCls} rounded-[--radius-default] ${className}`.trim(),
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
