"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
	THEME_ATTR,
	THEME_CHANGE_EVENT,
	THEME_STORAGE_KEY,
} from "./theme-constants.js";

const ThemeCtx = createContext({ theme: "dark", setTheme: () => {} });

/**
 * Wraps a subtree with a shared theme value.
 *
 * Behaviour:
 * - If `defaultTheme` is provided it is used as the initial value (good for
 *   pages that have a deliberate starting theme, e.g. the playground).
 * - If `defaultTheme` is omitted, the initial value is derived from the OS
 *   `prefers-color-scheme` media query on first mount.
 * - In both cases the user's explicit toggle choice is persisted to
 *   `localStorage` under the key `quark-theme` and restored on subsequent
 *   visits so their preference is remembered across sessions.
 *
 * @param {{ defaultTheme?: 'light' | 'dark', children: React.ReactNode }} props
 */
export function ThemeProvider({ defaultTheme, children }) {
	// Lazy initialiser — runs synchronously on the client before first paint,
	// so the correct theme is in place from frame 0 (no flash).
	// On the server `window` is undefined, so we fall back to defaultTheme ?? 'dark'.
	const [theme, setTheme] = useState(() => {
		if (typeof window === "undefined") return defaultTheme ?? "dark";
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === "light" || stored === "dark") return stored;
		if (defaultTheme != null) return defaultTheme;
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

	// Keep state in sync when the OS colour scheme changes (only relevant when
	// no defaultTheme was provided and the user has no stored preference).
	useEffect(() => {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored || defaultTheme != null) return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (e) => setTheme(e.matches ? "dark" : "light");
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, [defaultTheme]);

	// Listen for toggles fired by HomeThemeToggle (or any other out-of-tree
	// component) so React context stays in sync without any import coupling.
	useEffect(() => {
		function onExternalChange(e) {
			const t = e.detail?.theme;
			if (t === "light" || t === "dark") setTheme(t);
		}
		document.addEventListener(THEME_CHANGE_EVENT, onExternalChange);
		return () =>
			document.removeEventListener(THEME_CHANGE_EVENT, onExternalChange);
	}, []);

	function persistSetTheme(t) {
		localStorage.setItem(THEME_STORAGE_KEY, t);
		document.documentElement.setAttribute(THEME_ATTR, t);
		setTheme(t);
	}

	return React.createElement(
		ThemeCtx.Provider,
		{ value: { theme, setTheme: persistSetTheme } },
		children,
	);
}

/**
 * Returns the current theme and a setter from the nearest ThemeProvider.
 * Falls back to `{ theme: 'light' }` when used outside a provider.
 *
 * @returns {{ theme: 'light' | 'dark', setTheme: (t: string) => void }}
 */
export function useTheme() {
	return useContext(ThemeCtx);
}

/**
 * Slide-pill toggle that switches between light and dark themes.
 * 32×18 px track with a 12 px sliding knob. Pure inline styles — no
 * Tailwind dependency. Must be rendered inside a ThemeProvider.
 */
export function ThemeToggle({ className = "", style = {} }) {
	const { theme, setTheme } = useTheme();
	const isDark = theme === "dark";

	return React.createElement(
		"button",
		{
			type: "button",
			onClick: () => setTheme(isDark ? "light" : "dark"),
			"aria-label": `Switch to ${isDark ? "light" : "dark"} theme`,
			"aria-pressed": isDark,
			className: className || undefined,
			style: {
				display: "inline-flex",
				alignItems: "center",
				width: "32px",
				height: "18px",
				borderRadius: "9px",
				border: `1px solid ${isDark ? "#1e2d45" : "#d1d5db"}`,
				background: isDark ? "#0d1420" : "#e5e7eb",
				cursor: "pointer",
				padding: "2px",
				transition: "background 0.2s ease, border-color 0.2s ease",
				outline: "none",
				flexShrink: 0,
				...style,
			},
		},
		React.createElement("span", {
			"aria-hidden": "true",
			style: {
				display: "block",
				width: "12px",
				height: "12px",
				borderRadius: "50%",
				background: isDark ? "#377dff" : "#9ca3af",
				transform: isDark ? "translateX(14px)" : "translateX(0)",
				transition: "transform 0.2s ease, background 0.2s ease",
				flexShrink: 0,
			},
		}),
	);
}
