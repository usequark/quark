"use client";

import { ThemeProvider, useTheme } from "@techstream/quark-ui";
import { useState } from "react";

function ThemeToggleButton({ collapsed = false }) {
	const { theme, setTheme } = useTheme();
	const isDark = theme === "dark";
	// Increment to retrigger the spin animation on each click
	const [spinKey, setSpinKey] = useState(0);

	function handleToggle() {
		setSpinKey((k) => k + 1);
		setTheme(isDark ? "light" : "dark");
	}

	return (
		<button
			type="button"
			className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-all duration-150 w-full text-left cursor-pointer"
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			title={collapsed ? (isDark ? "Light Mode" : "Dark Mode") : undefined}
			onClick={handleToggle}
		>
			<svg
				key={spinKey}
				aria-hidden="true"
				className="w-4 h-4 shrink-0 admin-theme-toggle-icon"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth="2"
			>
				{isDark ? (
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
					/>
				) : (
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				)}
			</svg>
			<span
				className={`whitespace-nowrap transition-opacity duration-200 ${
					collapsed ? "opacity-0" : "opacity-100"
				}`}
			>
				{isDark ? "Dark Mode" : "Light Mode"}
			</span>
		</button>
	);
}

export default function AdminThemeToggle({ collapsed = false }) {
	return (
		<ThemeProvider>
			<ThemeToggleButton collapsed={collapsed} />
		</ThemeProvider>
	);
}
