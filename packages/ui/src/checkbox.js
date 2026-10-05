import React from "react";

const inputCls =
	"h-4 w-4 rounded border-(--checkbox-border) bg-(--checkbox-bg) accent-(--checkbox-accent) transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--checkbox-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--checkbox-disabled-opacity)]";

const labelCls = "text-sm text-(--checkbox-label-text) select-none";

export function Checkbox({ id, label, className = "", ...props }) {
	return React.createElement(
		"div",
		{ className: "flex items-center gap-2" },
		React.createElement("input", {
			id,
			type: "checkbox",
			className: `${inputCls} ${className}`.trim(),
			...props,
		}),
		React.createElement("label", { htmlFor: id, className: labelCls }, label),
	);
}
