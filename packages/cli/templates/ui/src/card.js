import React from "react";

export function Card({ className = "", ...props }) {
	return React.createElement("div", {
		className:
			`rounded-xl border border-gray-200 bg-white/95 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`.trim(),
		...props,
	});
}

export function CardHeader({ className = "", ...props }) {
	return React.createElement("div", {
		className: `flex flex-col space-y-1.5 p-6 ${className}`.trim(),
		...props,
	});
}

export function CardTitle({ className = "", ...props }) {
	return React.createElement("h3", {
		className:
			`text-lg font-semibold leading-none tracking-tight text-gray-900 ${className}`.trim(),
		...props,
	});
}

export function CardContent({ className = "", ...props }) {
	return React.createElement("div", {
		className: `p-6 pt-0 ${className}`.trim(),
		...props,
	});
}

export function CardFooter({ className = "", ...props }) {
	return React.createElement("div", {
		className: `flex items-center p-6 pt-0 ${className}`.trim(),
		...props,
	});
}
