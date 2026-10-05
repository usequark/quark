import React from "react";

const base =
	"block h-10 w-full border border-(--input-border) bg-(--input-bg) px-3 text-sm text-(--input-text) placeholder:text-(--input-placeholder) transition-colors duration-200 linear hover:border-(--input-border-hover) focus-visible:border-(--input-border-focus) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-ring-focus)] disabled:opacity-(--input-disabled-opacity) disabled:cursor-not-allowed";

export function Input({ className = "", ...props }) {
	return React.createElement("input", {
		className: `${base} rounded-(--radius-default) ${className}`.trim(),
		...props,
	});
}
