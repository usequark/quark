import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
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

const sortButtonCls =
	"group inline-flex w-full items-center justify-between gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-[--radius-default]";

const sortIconCls = "text-text-faint transition-colors group-hover:text-text";

function toAriaSort(direction) {
	if (direction === "asc") return "ascending";
	if (direction === "desc") return "descending";
	return "none";
}

function nextDirection(direction) {
	if (direction === "none") return "asc";
	if (direction === "asc") return "desc";
	return "none";
}

function sortIndicator(direction) {
	if (direction === "asc") return React.createElement(ChevronUp, { size: 14 });
	if (direction === "desc")
		return React.createElement(ChevronDown, { size: 14 });
	return React.createElement(ChevronsUpDown, { size: 14 });
}

function headingText(children) {
	if (typeof children === "string" || typeof children === "number") {
		return String(children);
	}
	return "column";
}

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

export function TableHead({
	className = "",
	sortable = false,
	sortDirection = "none",
	onSort,
	sortLabel,
	children,
	...props
}) {
	const direction =
		sortDirection === "asc" || sortDirection === "desc"
			? sortDirection
			: "none";

	if (!sortable) {
		return React.createElement(
			"th",
			{
				className: `${headCls} ${className}`.trim(),
				...props,
			},
			children,
		);
	}

	return React.createElement(
		"th",
		{
			className: `${headCls} ${className}`.trim(),
			"aria-sort": toAriaSort(direction),
			...props,
		},
		React.createElement(
			"button",
			{
				type: "button",
				onClick:
					typeof onSort === "function"
						? () => onSort(nextDirection(direction))
						: undefined,
				disabled: typeof onSort !== "function",
				"aria-label": sortLabel ?? `Sort by ${headingText(children)}`,
				className: `${sortButtonCls} ${typeof onSort !== "function" ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`,
			},
			React.createElement("span", null, children),
			React.createElement(
				"span",
				{
					"aria-hidden": "true",
					className:
						`${sortIconCls} ${direction !== "none" ? "text-primary" : ""}`.trim(),
				},
				sortIndicator(direction),
			),
		),
	);
}

export function TableCell({ className = "", ...props }) {
	return React.createElement("td", {
		className: `${cellCls} ${className}`.trim(),
		...props,
	});
}
