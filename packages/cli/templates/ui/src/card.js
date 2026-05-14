import { ChevronDown } from "lucide-react";
import React from "react";

const cardCls =
	"border border-border bg-surface transition-colors duration-200 linear";

const headerCls = "flex flex-col space-y-1.5 p-6";

const titleCls = "text-lg font-bold leading-none tracking-tight text-text";

const contentCls = "p-6 pt-0";

const footerCls = "flex items-center p-6 pt-0";

const collapsibleSummaryCls =
	"flex cursor-pointer list-none items-center justify-between p-6 text-text transition-colors duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden";

const collapsibleChevronCls =
	"pointer-events-none ml-3 shrink-0 rotate-0 text-text-faint transition-transform duration-300 ease-in-out group-open:rotate-180";

const collapsiblePanelCls = "border-t border-border text-text-muted";

const collapsibleInnerCls = "block p-6";

export function Card({
	className = "",
	variant = "default",
	collapsibleLabel = "Card Details",
	defaultOpen = false,
	children,
	...props
}) {
	if (variant === "collapsible") {
		return React.createElement(
			"details",
			{
				className:
					`${cardCls} group h-fit self-start rounded-[--radius-default] ${className}`.trim(),
				open: defaultOpen,
				...props,
			},
			React.createElement(
				"summary",
				{ className: collapsibleSummaryCls },
				React.createElement(
					"div",
					{ className: "text-base font-bold tracking-tight flex" },
					React.createElement("span", null, collapsibleLabel),
				),
				React.createElement(
					"span",
					{
						"aria-hidden": "true",
						"data-chevron": "true",
						className: collapsibleChevronCls,
					},
					React.createElement(ChevronDown, { size: 16 }),
				),
			),

			React.createElement(
				"div",
				{ className: collapsiblePanelCls },
				React.createElement(
					"div",
					{ className: collapsibleInnerCls },
					children,
				),
			),
		);
	}

	return React.createElement(
		"div",
		{
			className: `${cardCls} rounded-[--radius-default] ${className}`.trim(),
			...props,
		},
		children,
	);
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
