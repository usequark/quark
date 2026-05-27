"use client";

import { ChevronDown } from "lucide-react";
import React, { useState } from "react";

const cardCls =
	"border border-border bg-surface transition-colors duration-200 linear";

const headerCls = "flex flex-col space-y-1.5 p-6";

const titleCls = "text-lg font-bold leading-none tracking-tight text-text";

const contentCls = "p-6 pt-0";

const footerCls = "flex items-center p-6 pt-0";

const collapsibleTriggerCls =
	"flex w-full cursor-pointer items-center justify-between p-6 text-text transition-colors duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function CollapsibleCard({
	className = "",
	collapsibleLabel = "Card Details",
	defaultOpen = false,
	children,
	...props
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	return React.createElement(
		"div",
		{
			className:
				`${cardCls} h-fit self-start rounded-[--radius-default] ${className}`.trim(),
			...props,
		},
		React.createElement(
			"button",
			{
				type: "button",
				className: collapsibleTriggerCls,
				onClick: () => setIsOpen((prev) => !prev),
				"aria-expanded": isOpen,
			},
			React.createElement(
				"div",
				{ className: "text-base font-bold tracking-tight flex" },
				React.createElement("span", null, collapsibleLabel),
			),
			React.createElement(
				"span",
				{
					"aria-hidden": "true",
					className: `pointer-events-none ml-3 shrink-0 text-text-faint transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? "rotate-180" : "rotate-0"}`,
				},
				React.createElement(ChevronDown, { size: 16 }),
			),
		),
		React.createElement(
			"div",
			{
				className: `border-t border-border text-text-muted grid transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${isOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`,
				style: { gridTemplateRows: isOpen ? "1fr" : "0fr" },
			},
			React.createElement(
				"div",
				{ className: "overflow-hidden min-h-0" },
				React.createElement("div", { className: "p-6" }, children),
			),
		),
	);
}

export function Card({
	className = "",
	variant = "default",
	collapsibleLabel = "Card Details",
	defaultOpen = false,
	children,
	...props
}) {
	if (variant === "collapsible") {
		return React.createElement(CollapsibleCard, {
			className,
			collapsibleLabel,
			defaultOpen,
			children,
			...props,
		});
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
