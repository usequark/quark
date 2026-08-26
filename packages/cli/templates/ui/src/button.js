import Link from "next/link.js";
import React from "react";
import { Spinner } from "./spinner.js";

const base =
	"inline-flex items-center justify-center font-medium tracking-wide transition-all duration-200 linear cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed active:opacity-80";

const variantCls =
	"bg-[--btn-bg] border border-[--btn-border] text-[--btn-text] rounded-[--btn-radius] hover:brightness-[var(--btn-hover-brightness)] hover:shadow-[var(--btn-hover-shadow)] hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] hover:opacity-[var(--btn-hover-opacity)] focus-visible:ring-[var(--btn-ring)]";

const sizeStyles = {
	sm: {
		height: "var(--btn-sm-height)",
		paddingLeft: "var(--btn-sm-padding-x)",
		paddingRight: "var(--btn-sm-padding-x)",
		fontSize: "var(--btn-sm-font-size)",
	},
	md: {
		height: "var(--btn-md-height)",
		paddingLeft: "var(--btn-md-padding-x)",
		paddingRight: "var(--btn-md-padding-x)",
		fontSize: "var(--btn-md-font-size)",
	},
	lg: {
		height: "var(--btn-lg-height)",
		paddingLeft: "var(--btn-lg-padding-x)",
		paddingRight: "var(--btn-lg-padding-x)",
		fontSize: "var(--btn-lg-font-size)",
	},
};

const iconSizes = {
	sm: "var(--btn-icon-sm)",
	md: "var(--btn-icon-md)",
	lg: "var(--btn-icon-lg)",
};

function buildIcon(icon, size) {
	if (!icon) return null;

	const iconClass = `${iconSizes[size] ?? iconSizes.md} shrink-0`;

	if (React.isValidElement(icon)) {
		const existingClassName = icon.props.className ?? "";
		return React.cloneElement(icon, {
			"aria-hidden": true,
			focusable: false,
			className: `${iconClass} ${existingClassName}`.trim(),
		});
	}

	return React.createElement(
		"span",
		{
			"aria-hidden": true,
			className: iconClass,
		},
		icon,
	);
}

export function Button({
	variant = "default",
	size = "md",
	className = "",
	href,
	target,
	rel,
	type = "button",
	icon,
	loading = false,
	children,
	...props
}) {
	const hasLabel =
		children !== null && children !== undefined && children !== false;
	const hasIcon = Boolean(icon);
	const spacing = hasIcon && hasLabel ? "gap-2" : "";
	const cls = `${base} ${variantCls} ${spacing} ${className}`.trim();
	const sizeStyle = sizeStyles[size] ?? sizeStyles.md;
	const buttonType =
		type === "submit" || type === "reset" || type === "button"
			? type
			: "button";

	const buttonChildren = [];

	if (loading)
		buttonChildren.push(
			React.createElement(Spinner, { key: "spinner", className: "h-4 w-4" }),
		);
	if (hasIcon) buttonChildren.push(buildIcon(icon, size));
	if (hasLabel) buttonChildren.push(children);

	if (href) {
		const anchorRel =
			target === "_blank" ? (rel ?? "noopener noreferrer") : rel;
		return React.createElement(
			Link,
			{
				href: loading ? undefined : href,
				target,
				rel: anchorRel,
				className: cls,
				style: sizeStyle,
				"data-btn-variant": variant,
				"aria-disabled": loading || undefined,
				...props,
			},
			...buttonChildren,
		);
	}

	return React.createElement(
		"button",
		{
			type: buttonType,
			className: cls,
			style: sizeStyle,
			"data-btn-variant": variant,
			disabled: loading || props.disabled,
			...props,
		},
		...buttonChildren,
	);
}
