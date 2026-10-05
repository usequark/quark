"use client";
import React, { useId } from "react";
import { Input } from "./input.js";
import { Label } from "./label.js";

export function FormField({
	label,
	name,
	error,
	children,
	className = "",
	...props
}) {
	const generatedId = useId();
	const fieldId = props.id ?? generatedId;

	const errorId = `${fieldId}-error`;

	const inputProps = { id: fieldId, name, ...props };
	if (error) {
		inputProps["aria-invalid"] = true;
		inputProps["aria-describedby"] = errorId;
	}

	const childrenWrapperProps = {};
	if (error) {
		childrenWrapperProps["aria-invalid"] = true;
		childrenWrapperProps["aria-describedby"] = errorId;
	}

	return React.createElement(
		"div",
		{ className: `min-w-0 space-y-1.5 ${className}`.trim() },
		label ? React.createElement(Label, { htmlFor: fieldId }, label) : null,
		children
			? React.createElement("div", childrenWrapperProps, children)
			: React.createElement(Input, inputProps),
		error
			? React.createElement(
					"p",
					{
						id: errorId,
						className: "text-xs text-(--error-text)",
						role: "alert",
					},
					error,
				)
			: null,
	);
}
