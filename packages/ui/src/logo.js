import React from "react";

/**
 * QuarkLogo - inline SVG of the Quark ring+dash mark.
 * Pure server component. Accepts `size` (number, default 40) and `className`.
 */
export function QuarkLogo({ size = 40, className = "", ...props }) {
	return React.createElement(
		"svg",
		{
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 200 200",
			fill: "none",
			width: size,
			height: size,
			"aria-hidden": "true",
			className,
			...props,
		},
		// Dark arc - upper semicircle
		React.createElement("path", {
			d: "M 35,100 A 65,65 0 0,1 165,100",
			stroke: "var(--quark-logo-dark-arc, #2d3436)",
			strokeWidth: 26,
			strokeLinecap: "butt",
		}),
		// Blue arc - bottom-left
		React.createElement("path", {
			d: "M 119.1,162.1 A 65,65 0 0,1 35,100",
			stroke: "#377dff",
			strokeWidth: 26,
			strokeLinecap: "butt",
		}),
		// Red arc - tiny pre-gap sliver
		React.createElement("path", {
			d: "M 165,100 A 65,65 0 0,1 161.5,121",
			stroke: "#ff4757",
			strokeWidth: 26,
			strokeLinecap: "butt",
		}),
		// Red dash - radial tail through the gap
		React.createElement("line", {
			x1: 116.3,
			y1: 116.8,
			x2: 172,
			y2: 174.2,
			stroke: "#ff4757",
			strokeWidth: 28,
			strokeLinecap: "butt",
		}),
	);
}
