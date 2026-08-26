import React from "react";

export function ErrorBanner({ message, className = "" }) {
	if (!message) return null;
	return React.createElement(
		"div",
		{
			role: "alert",
			"aria-live": "polite",
			className:
				`border border-[--error-border] bg-[--error-bg] text-[--error-text] rounded-[--radius-default] ${className}`.trim(),
			style: {
				marginBottom: "var(--error-banner-margin-bottom)",
				paddingLeft: "var(--error-banner-padding-x)",
				paddingRight: "var(--error-banner-padding-x)",
				paddingTop: "var(--error-banner-padding-y)",
				paddingBottom: "var(--error-banner-padding-y)",
				fontSize: "var(--error-banner-font-size)",
			},
		},
		message,
	);
}
