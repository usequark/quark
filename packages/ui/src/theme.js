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

// `undefined` means "no ThemeProvider above this consumer". It must not be a
// usable default: a plausible-looking default ({ theme, setTheme: noop }) turns a
// missing provider into a silently broken toggle that still renders and still
// reports a theme. See useTheme().
const ThemeCtx = createContext(undefined);

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
 *
 * Throws when there is no ThemeProvider above the caller. A missing provider is
 * a wiring bug, not a state to default: `ThemeToggle` renders a labelled,
 * focusable button either way, so a silent fallback yields a control that looks
 * real, reports the wrong theme, and does nothing when clicked.
 *
 * @returns {{ theme: 'light' | 'dark', setTheme: (t: string) => void }}
 * @throws {Error} if called outside a ThemeProvider
 */
export function useTheme() {
	const ctx = useContext(ThemeCtx);
	if (ctx === undefined) {
		throw new Error(
			"useTheme() must be used within a ThemeProvider. Wrap your app in <ThemeProvider> (import it from @scope/ui) around the tree containing this component.",
		);
	}
	return ctx;
}

/**
 * Labeled pill button that shows the current theme and switches on click.
 * Displays "🌙 Dark Mode" when dark, "☀ Light Mode" when light.
 * Must be rendered inside a ThemeProvider — outside one, `useTheme()` throws.
 */
export function ThemeToggle({ className = "" }) {
	const { theme, setTheme } = useTheme();
	const isDark = theme === "dark";

	const icon = isDark
		? React.createElement(
				"svg",
				{
					"aria-hidden": "true",
					width: "13",
					height: "13",
					viewBox: "0 0 24 24",
					fill: "currentColor",
					className: "shrink-0",
				},
				React.createElement("path", {
					d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
				}),
			)
		: React.createElement(
				"svg",
				{
					"aria-hidden": "true",
					width: "13",
					height: "13",
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					className: "shrink-0",
				},
				React.createElement("circle", { cx: "12", cy: "12", r: "5" }),
				React.createElement("line", { x1: "12", y1: "1", x2: "12", y2: "3" }),
				React.createElement("line", { x1: "12", y1: "21", x2: "12", y2: "23" }),
				React.createElement("line", {
					x1: "4.22",
					y1: "4.22",
					x2: "5.64",
					y2: "5.64",
				}),
				React.createElement("line", {
					x1: "18.36",
					y1: "18.36",
					x2: "19.78",
					y2: "19.78",
				}),
				React.createElement("line", { x1: "1", y1: "12", x2: "3", y2: "12" }),
				React.createElement("line", { x1: "21", y1: "12", x2: "23", y2: "12" }),
				React.createElement("line", {
					x1: "4.22",
					y1: "19.78",
					x2: "5.64",
					y2: "18.36",
				}),
				React.createElement("line", {
					x1: "18.36",
					y1: "5.64",
					x2: "19.78",
					y2: "4.22",
				}),
			);

	return React.createElement(
		"button",
		{
			type: "button",
			onClick: () => setTheme(isDark ? "light" : "dark"),
			"aria-label": `Switch to ${isDark ? "light" : "dark"} theme`,
			"aria-pressed": isDark,
			className:
				`inline-flex items-center cursor-pointer whitespace-nowrap shrink-0 outline-none transition-[background,border-color,color] duration-150 ease-in ${className || ""}`.trim(),
			style: {
				gap: "var(--toggle-gap, 6px)",
				height: "var(--toggle-height, 28px)",
				paddingLeft: "var(--toggle-padding-x, 10px)",
				paddingRight: "var(--toggle-padding-x-right, 12px)",
				borderRadius: "var(--toggle-radius, 14px)",
				border: "1px solid var(--toggle-track-border)",
				background: "var(--toggle-track-bg)",
				color: "var(--toggle-text, var(--color-text-muted))",
				fontSize: "var(--toggle-font-size, 12px)",
				fontWeight: "500",
				letterSpacing: "0.01em",
			},
		},
		icon,
		isDark ? "Dark Mode" : "Light Mode",
	);
}
