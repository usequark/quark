import React from "react";

const base =
	"inline-flex items-center justify-center font-medium tracking-wide transition-all duration-200 linear cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed active:opacity-80";

const VARIANTS = {
	primary:
		"bg-primary border border-primary text-white hover:brightness-90 hover:shadow-md focus-visible:ring-primary/60",
	secondary:
		"border border-border-hover bg-surface text-text hover:bg-surface-hover focus-visible:ring-border-hover",
	danger:
		"bg-danger border border-danger text-white hover:brightness-90 hover:shadow-md focus-visible:ring-danger/60",
	ghost:
		"bg-transparent text-text-faint hover:bg-surface-hover hover:text-text focus-visible:ring-border-hover",
	success:
		"bg-success border border-success text-white hover:opacity-90 focus-visible:ring-success/60",
	warning:
		"bg-warning border border-warning text-white hover:opacity-90 focus-visible:ring-warning/60",
	info: "bg-info border border-info text-white hover:opacity-90 focus-visible:ring-info/60",
	outline:
		"border border-primary text-primary bg-transparent hover:bg-primary-muted focus-visible:ring-primary/40",
	solid: "bg-primary border border-primary text-white hover:opacity-90 focus-visible:ring-primary/60",
};

const sizes = {
	sm: "h-8 px-3 text-sm",
	md: "h-10 px-4 text-sm",
	lg: "h-11 px-6 text-base",
};

const iconSizes = {
	sm: "size-4",
	md: "size-4",
	lg: "size-5",
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
	variant = "primary",
	size = "md",
	className = "",
	icon,
	children,
	...props
}) {
	const hasLabel =
		children !== null && children !== undefined && children !== false;
	const hasIcon = Boolean(icon);
	const spacing = hasIcon && hasLabel ? "gap-2" : "";
	const cls =
		`${base} ${VARIANTS[variant] ?? VARIANTS.primary} ${sizes[size] ?? sizes.md} ${spacing} rounded-[--radius-default] ${className}`.trim();

	const buttonChildren = [];

	if (hasIcon) buttonChildren.push(buildIcon(icon, size));
	if (hasLabel) buttonChildren.push(children);

	return React.createElement(
		"button",
		{
			type: "button",
			className: cls,
			...props,
		},
		...buttonChildren,
	);
}
