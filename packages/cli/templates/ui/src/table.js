import React from "react";

const wrapperCls =
	"w-full overflow-auto rounded-[--radius-default] border border-border bg-surface";

const tableCls = "w-full caption-bottom text-sm";

const headerCls = "border-b border-border bg-surface-hover";

const bodyCls = "[&_tr:last-child]:border-0";

const rowCls =
	"border-b border-border/50 transition-colors hover:bg-surface-hover/60 active:bg-surface-hover/40";

const headCls =
	"h-11 px-3 text-left align-middle font-medium text-text-faint dark:font-mono dark:text-xs dark:uppercase dark:tracking-widest";

const cellCls = "p-3 align-middle text-text dark:font-mono dark:text-sm";

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
