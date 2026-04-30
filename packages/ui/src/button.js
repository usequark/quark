import React from "react";

const base =
	"inline-flex items-center justify-center font-medium tracking-wide transition-all duration-200 linear cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed active:opacity-80";

const VARIANTS = {
	// Primary: tinted ghost on dark, solid on light — both pull from --color-primary
	primary:
		"bg-primary-muted border border-primary/40 text-primary hover:bg-primary-muted hover:border-primary/80 focus-visible:ring-primary/40",
	secondary:
		"border border-border bg-surface text-text-muted hover:border-border-hover hover:text-text focus-visible:ring-border-hover",
	danger:
		"bg-danger-muted border border-danger/40 text-danger hover:bg-danger-muted hover:border-danger/80 focus-visible:ring-danger/40",
	ghost:
		"bg-transparent text-text-faint hover:bg-surface-hover hover:text-text focus-visible:ring-border-hover",
	success:
		"bg-success-muted border border-success/40 text-success hover:border-success/80 focus-visible:ring-success/40",
	warning:
		"bg-warning-muted border border-warning/40 text-warning hover:border-warning/80 focus-visible:ring-warning/40",
	info: "bg-info-muted border border-info/40 text-info hover:border-info/80 focus-visible:ring-info/40",
	outline:
		"border border-primary text-primary bg-transparent hover:bg-primary-muted focus-visible:ring-primary/40",
	solid: "bg-primary text-white hover:opacity-90 focus-visible:ring-primary/60",
};

const sizes = {
	sm: "h-8 px-3 text-xs",
	md: "h-10 px-4 text-sm",
	lg: "h-11 px-6 text-sm",
};

export function Button({
	variant = "primary",
	size = "md",
	className = "",
	...props
}) {
	const cls =
		`${base} ${VARIANTS[variant] ?? VARIANTS.primary} ${sizes[size] ?? sizes.md} rounded-[--radius-default] ${className}`.trim();
	return React.createElement("button", {
		type: "button",
		className: cls,
		...props,
	});
}
