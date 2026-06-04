import React from "react";

export function Container({ className = "", children, ...props }) {
	return React.createElement(
		"section",
		{
			className:
				`relative overflow-hidden rounded-[--radius-default] border border-border bg-surface ${className}`.trim(),
			...props,
		},
		children,
	);
}
