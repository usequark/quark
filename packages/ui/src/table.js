import React from "react";

const wrapperCls =
	"w-full overflow-auto rounded border border-gray-200 dark:border-[#1e2535] bg-white dark:bg-[#0d1117]";

const tableCls = "w-full caption-bottom text-sm";

const headerCls = "border-b bg-gray-50 dark:bg-[#090d14] dark:border-[#1e2535]";

const bodyCls = "[&_tr:last-child]:border-0";

const rowCls =
	"border-b border-gray-100 dark:border-[#1e2535]/50 transition-colors hover:bg-gray-50/80 dark:hover:bg-[#1e2535]/40 active:bg-gray-100 dark:active:bg-transparent";

const headCls =
	"h-11 px-3 text-left align-middle font-medium text-gray-600 dark:text-[#4a4a6a] dark:font-mono dark:text-xs dark:uppercase dark:tracking-widest";

const cellCls =
	"p-3 align-middle text-gray-700 dark:text-[#e0e0e0] dark:font-mono dark:text-sm";

export function Table({ className = "", ...props }) {
	return React.createElement(
		"div",
		{ className: wrapperCls },
		React.createElement("table", {
			className: `${tableCls} ${className}`.trim(),
			...props,
		}),
	);
}

export function TableHeader({ className = "", ...props }) {
	return React.createElement("thead", {
		className: `${headerCls} ${className}`.trim(),
		...props,
	});
}

export function TableBody({ className = "", ...props }) {
	return React.createElement("tbody", {
		className: `${bodyCls} ${className}`.trim(),
		...props,
	});
}

export function TableRow({ className = "", ...props }) {
	return React.createElement("tr", {
		className: `${rowCls} ${className}`.trim(),
		...props,
	});
}

export function TableHead({ className = "", ...props }) {
	return React.createElement("th", {
		className: `${headCls} ${className}`.trim(),
		...props,
	});
}

export function TableCell({ className = "", ...props }) {
	return React.createElement("td", {
		className: `${cellCls} ${className}`.trim(),
		...props,
	});
}
