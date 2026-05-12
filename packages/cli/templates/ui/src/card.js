import React from "react";

const cardCls =
	"border border-border bg-surface transition-colors duration-200 linear";

const headerCls = "flex flex-col space-y-1.5 p-6";

const titleCls = "text-lg font-bold leading-none tracking-tight text-text";

const contentCls = "p-6 pt-0";

const footerCls = "flex items-center p-6 pt-0";

const collapsibleSummaryCls =
	"block p-6 pr-12 text-text transition-colors duration-200 hover:bg-surface-hover";

const collapsibleChevronCls =
	"pointer-events-none absolute right-6 top-6 text-text-faint transition-transform duration-300 ease-in-out peer-checked:rotate-180";

const collapsiblePanelCls =
	"grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-in-out peer-checked:grid-rows-[1fr] peer-checked:opacity-100";

const collapsibleBodyCls =
	"min-h-0 overflow-hidden border-t border-border text-text-muted";

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
			"div",
			{
				className:
					`${cardCls} h-fit self-start rounded-[--radius-default] ${className}`.trim(),
				...props,
			},
			React.createElement(
				"label",
				{ className: "relative block cursor-pointer" },
				React.createElement("input", {
					type: "checkbox",
					defaultChecked: defaultOpen,
					className: "peer sr-only",
				}),
				React.createElement(
					"span",
					{ className: collapsibleSummaryCls },
					React.createElement(
						"span",
						{ className: "text-base font-bold tracking-tight" },
						collapsibleLabel,
					),
				),
				React.createElement(
					"span",
					{
						"aria-hidden": "true",
						className: collapsibleChevronCls,
					},
					"\u25be",
				),
				React.createElement(
					"span",
					{ className: collapsiblePanelCls },
					React.createElement(
						"span",
						{ className: collapsibleBodyCls },
						React.createElement(
							"span",
							{ className: collapsibleInnerCls },
							children,
						),
					),
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
