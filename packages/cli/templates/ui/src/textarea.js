import React from "react";

const base =
	"block w-full rounded-[--radius-default] border border-[--input-border] bg-[--input-bg] text-[--input-text] placeholder:text-[--input-placeholder] transition-colors duration-200 hover:border-[--input-border-hover] focus-visible:border-[--input-border-focus] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-ring-focus)] disabled:opacity-[--input-disabled-opacity] disabled:cursor-not-allowed resize-y";

export function Textarea({ className = "", ...props }) {
	return React.createElement("textarea", {
		className: `${base} ${className}`.trim(),
		style: {
			paddingLeft: "var(--textarea-padding-x)",
			paddingRight: "var(--textarea-padding-x)",
			paddingTop: "var(--textarea-padding-y)",
			paddingBottom: "var(--textarea-padding-y)",
			fontSize: "var(--textarea-font-size)",
		},
		...props,
	});
}
