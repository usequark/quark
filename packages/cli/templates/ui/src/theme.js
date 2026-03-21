"use client";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useState,
} from "react";
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
 * - If `defaultTheme` is provided it is used as the fallback when no stored
 *   preference exists (good for pages with a deliberate starting theme).
 * - If `defaultTheme` is omitted the fallback is the OS `prefers-color-scheme`
 *   media query, evaluated after hydration in a layout effect.
 * - The user's explicit toggle choice is persisted to
 *   `localStorage` under the key `quark-theme` and restored on subsequent
 *   visits so their preference is remembered across sessions.
 *
 * @param {{ defaultTheme?: 'light' | 'dark', children: React.ReactNode }} props
 */
export function ThemeProvider({ defaultTheme, children }) {
	// Always initialize from the server-safe default. The lazy initialiser cannot
	// run during React hydration (React reuses the server state), so we sync to
	// the real user preference in a layout effect instead.
	const [theme, setTheme] = useState(defaultTheme ?? "dark");

	// useLayoutEffect fires synchronously after DOM mutations but BEFORE the
	// browser paints, so the toggle snaps to the correct position with no
	// visible flash. On the server it is a no-op (same as useEffect).
	useLayoutEffect(() => {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		const resolved =
			stored === "light" || stored === "dark"
				? stored
				: (defaultTheme ??
					(window.matchMedia("(prefers-color-scheme: dark)").matches
						? "dark"
						: "light"));
		document.documentElement.setAttribute(THEME_ATTR, resolved);
		setTheme(resolved);
	}, [defaultTheme]);

	const persistSetTheme = useCallback((t) => {
		localStorage.setItem(THEME_STORAGE_KEY, t);
		document.documentElement.setAttribute(THEME_ATTR, t);
		setTheme(t);
	}, []);

	// Keep state and DOM in sync when the OS colour scheme changes (only
	// relevant when no defaultTheme was provided and the user has no stored
	// preference). Must call persistSetTheme so data-theme and CSS vars update.
	useEffect(() => {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored || defaultTheme != null) return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (e) => persistSetTheme(e.matches ? "dark" : "light");
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, [defaultTheme, persistSetTheme]);

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

	return React.createElement(
		ThemeCtx.Provider,
		{ value: { theme, setTheme: persistSetTheme } },
		children,
	);
}

/**
 * Returns the current theme and a setter from the nearest ThemeProvider.
 * Falls back to `{ theme: 'dark' }` when used outside a provider.
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
				border: "1px solid var(--toggle-track-border)",
				background: "var(--toggle-track-bg)",
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
				background: "var(--toggle-knob-bg)",
				transform: "var(--toggle-knob-x)",
				transition: "transform 0.2s ease, background 0.2s ease",
				flexShrink: 0,
			},
		}),
	);
}
