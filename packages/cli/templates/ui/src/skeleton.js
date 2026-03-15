import React from "react";

const THEMES = {
	light: "animate-pulse rounded-lg bg-gray-200/80",
	dark: "animate-pulse rounded-lg bg-[#1e2535]/70",
};

export function Skeleton({ theme = "light", className = "", ...props }) {
	const base = THEMES[theme] ?? THEMES.light;
	return React.createElement("div", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
