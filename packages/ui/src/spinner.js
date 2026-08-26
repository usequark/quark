import React from "react";

/**
 * Animated SVG spinner for loading states.
 * Server Component-safe — uses Tailwind's animate-spin.
 */
export function Spinner({ className = "", label = "Loading" }) {
	return React.createElement(
		"svg",
		{
			role: "img",
			"aria-label": label,
			className: `animate-spin ${className}`,
			style: { width: "var(--spinner-size)", height: "var(--spinner-size)" },
			viewBox: "0 0 24 24",
			fill: "none",
		},
		React.createElement("circle", {
			className: "opacity-25",
			cx: "12",
			cy: "12",
			r: "10",
			stroke: "currentColor",
			strokeWidth: "4",
		}),
		React.createElement("path", {
			className: "opacity-75",
			fill: "currentColor",
			d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z",
		}),
	);
}
