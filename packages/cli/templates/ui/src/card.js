import React from "react";

const THEMES = {
	light: {
		card: "rounded border border-gray-200 bg-white/95 shadow-sm transition-shadow duration-200 hover:shadow-md",
		header: "flex flex-col space-y-1.5 p-6",
		title: "text-lg font-semibold leading-none tracking-tight text-gray-900",
		content: "p-6 pt-0",
		footer: "flex items-center p-6 pt-0",
	},
	dark: {
		card: "rounded border border-[#1e2535] bg-[#0d1117] transition-all duration-200 hover:border-[#377dff]/30",
		header: "flex flex-col space-y-1.5 p-6",
		title: "text-lg font-semibold leading-none tracking-tight text-[#e0e0e0]",
		content: "p-6 pt-0",
		footer: "flex items-center p-6 pt-0",
	},
};

export function Card({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("div", {
		className: `${t.card} ${className}`.trim(),
		...props,
	});
}

export function CardHeader({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("div", {
		className: `${t.header} ${className}`.trim(),
		...props,
	});
}

export function CardTitle({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("h3", {
		className: `${t.title} ${className}`.trim(),
		...props,
	});
}

export function CardContent({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("div", {
		className: `${t.content} ${className}`.trim(),
		...props,
	});
}

export function CardFooter({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("div", {
		className: `${t.footer} ${className}`.trim(),
		...props,
	});
}
