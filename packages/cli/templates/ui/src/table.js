import React from "react";

export function Table({ className = "", ...props }) {
	return React.createElement(
		"div",
		{
			className:
				"w-full overflow-auto rounded-xl border border-gray-200 bg-white",
		},
		React.createElement("table", {
			className: `w-full caption-bottom text-sm ${className}`.trim(),
			...props,
		}),
	);
}

export function TableHeader({ className = "", ...props }) {
	return React.createElement("thead", {
		className: `border-b bg-gray-50 ${className}`.trim(),
		...props,
	});
}

export function TableBody({ className = "", ...props }) {
	return React.createElement("tbody", {
		className: `[&_tr:last-child]:border-0 ${className}`.trim(),
		...props,
	});
}

export function TableRow({ className = "", ...props }) {
	return React.createElement("tr", {
		className:
			`border-b border-gray-100 transition-colors hover:bg-gray-50/80 active:bg-gray-100 ${className}`.trim(),
		...props,
	});
}

export function TableHead({ className = "", ...props }) {
	return React.createElement("th", {
		className:
			`h-11 px-3 text-left align-middle font-medium text-gray-600 ${className}`.trim(),
		...props,
	});
}

export function TableCell({ className = "", ...props }) {
	return React.createElement("td", {
		className: `p-3 align-middle text-gray-700 ${className}`.trim(),
		...props,
	});
}
