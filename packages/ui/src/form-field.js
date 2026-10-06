"use client";
import React, { useId } from "react";
import { Input } from "./input.js";
import { Label } from "./label.js";

/**
 * Label + control + error message, wired together for accessibility.
 *
 * `className` is applied to the control, matching every other component in this
 * package (`Input`, `Textarea`, `Select`, `Card`, …), where it extends the
 * component's own root element. Use `wrapperClassName` to style the layout
 * container instead.
 *
 * The error association (`aria-invalid` / `aria-describedby`) always lands on
 * the focusable control, never on a wrapper element, so a screen reader that is
 * sitting on the control actually announces it.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.label]
 * @param {string} [props.name]
 * @param {string} [props.error]
 * @param {React.ReactNode} [props.children] custom control, e.g. a <Textarea>
 * @param {string} [props.className] classes for the control
 * @param {string} [props.wrapperClassName] classes for the layout container
 */
export function FormField({
	label,
	name,
	error,
	children,
	className = "",
	wrapperClassName = "",
	...props
}) {
	const generatedId = useId();
	const fieldId = props.id ?? generatedId;

	const errorId = `${fieldId}-error`;

	const ariaProps = error
		? { "aria-invalid": true, "aria-describedby": errorId }
		: {};

	const control = children
		? // A caller-supplied control already owns its own markup; forward the
			// accessibility wiring to it so the attributes land on the element
			// that can receive focus. Explicit props on the child win, so a
			// caller can still override them.
			React.Children.map(children, (child) => {
				if (!React.isValidElement(child)) return child;
				const merged = [child.props.className, className]
					.filter(Boolean)
					.join(" ");
				return React.cloneElement(child, {
					id: child.props.id ?? fieldId,
					name: child.props.name ?? name,
					// Omitted entirely when empty so a bare child is not given a
					// meaningless class="" attribute.
					...(merged ? { className: merged } : {}),
					...ariaProps,
				});
			})
		: React.createElement(Input, {
				id: fieldId,
				name,
				className,
				...ariaProps,
				...props,
			});

	return React.createElement(
		"div",
		{
			className: `min-w-0 space-y-1.5 ${wrapperClassName}`.trim(),
		},
		label ? React.createElement(Label, { htmlFor: fieldId }, label) : null,
		control,
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
