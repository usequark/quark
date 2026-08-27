import React from "react";

export function ErrorBanner({ message, className = "" }) {
	if (!message) return null;
	return React.createElement(
		"div",
		{
			role: "alert",
			"aria-live": "polite",
			className:
				`mb-4 border border-[--error-border] bg-[--error-bg] px-3 py-2 text-sm text-[--error-text] rounded-[--radius-default] ${className}`.trim(),
		},
		message,
	);
}
