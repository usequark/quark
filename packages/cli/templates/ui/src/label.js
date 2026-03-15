import React from "react";

const THEMES = {
	light: "block text-sm font-medium text-gray-700 tracking-tight",
	dark: "block text-sm font-medium text-[#4a4a6a] tracking-tight font-mono",
};

export function Label({ theme = "light", className = "", ...props }) {
	const base = THEMES[theme] ?? THEMES.light;
	return React.createElement("label", {
		className: `${base} ${className}`.trim(),
		...props,
	});
}
