import React from "react";

const base =
	"block w-full rounded-(--radius-default) border border-(--input-border) bg-(--input-bg) px-3 py-2 text-sm text-(--input-text) placeholder:text-(--input-placeholder) transition-colors duration-200 hover:border-(--input-border-hover) focus-visible:border-(--input-border-focus) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-ring-focus)] disabled:opacity-(--input-disabled-opacity) disabled:cursor-not-allowed resize-y";

export function Textarea({ className = "", ...props }) {
	return React.createElement("textarea", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
