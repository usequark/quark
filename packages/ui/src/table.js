import React from "react";

const THEMES = {
	light: {
		wrapper: "w-full overflow-auto rounded-xl border border-gray-200 bg-white",
		table: "w-full caption-bottom text-sm",
		header: "border-b bg-gray-50",
		body: "[&_tr:last-child]:border-0",
		row: "border-b border-gray-100 transition-colors hover:bg-gray-50/80 active:bg-gray-100",
		head: "h-11 px-3 text-left align-middle font-medium text-gray-600",
		cell: "p-3 align-middle text-gray-700",
	},
	dark: {
		wrapper:
			"w-full overflow-auto rounded-xl border border-[#1e2535] bg-[#0d1117]",
		table: "w-full caption-bottom text-sm",
		header: "border-b border-[#1e2535] bg-[#090d14]",
		body: "[&_tr:last-child]:border-0",
		row: "border-b border-[#1e2535]/50 transition-colors hover:bg-[#1e2535]/40",
		head: "h-11 px-3 text-left align-middle font-medium text-[#4a4a6a] font-mono text-xs uppercase tracking-widest",
		cell: "p-3 align-middle text-[#e0e0e0] font-mono text-sm",
	},
};

export function Table({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement(
		"div",
		{ className: t.wrapper },
		React.createElement("table", {
			className: `${t.table} ${className}`.trim(),
			...props,
		}),
	);
}

export function TableHeader({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("thead", {
		className: `${t.header} ${className}`.trim(),
		...props,
	});
}

export function TableBody({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("tbody", {
		className: `${t.body} ${className}`.trim(),
		...props,
	});
}

export function TableRow({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("tr", {
		className: `${t.row} ${className}`.trim(),
		...props,
	});
}

export function TableHead({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("th", {
		className: `${t.head} ${className}`.trim(),
		...props,
	});
}

export function TableCell({ theme = "light", className = "", ...props }) {
	const t = THEMES[theme] ?? THEMES.light;
	return React.createElement("td", {
		className: `${t.cell} ${className}`.trim(),
		...props,
	});
}
