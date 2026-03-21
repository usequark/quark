"use client";

import { useLayoutEffect, useState } from "react";
import {
	THEME_ATTR,
	THEME_CHANGE_EVENT,
	THEME_STORAGE_KEY,
} from "../../lib/theme.js";

/**
 * Text-link theme toggle for the home page nav.
 * Shows "light" when dark mode is active (click to switch to light) and vice versa.
 * Styled identically to the other nav links via the quark-home-link class.
 *
 * Uses the same localStorage key as ThemeProvider (THEME_STORAGE_KEY) and sets
 * the same HTML attribute (THEME_ATTR) so CSS variables react instantly. Fires
 * a THEME_CHANGE_EVENT custom event so ThemeProvider (if present) stays in sync
 * without any import coupling between the two packages.
 */
export default function HomeThemeToggle() {
	const [isDark, setIsDark] = useState(true);

	useLayoutEffect(() => {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === "light" || stored === "dark") {
			setIsDark(stored === "dark");
			document.documentElement.setAttribute(THEME_ATTR, stored);
			return;
		}
		const osDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		setIsDark(osDark);
	}, []);

	function toggle() {
		setIsDark((prev) => {
			const next = prev ? "light" : "dark";
			localStorage.setItem(THEME_STORAGE_KEY, next);
			document.documentElement.setAttribute(THEME_ATTR, next);
			// Notify ThemeProvider (if present in the tree) so React context stays in sync.
			document.dispatchEvent(
				new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: next } }),
			);
			return !prev;
		});
	}

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
			className="quark-home-link"
			style={{
				background: "none",
				border: "none",
				padding: 0,
				cursor: "pointer",
			}}
		>
			{isDark ? "light" : "dark"}
		</button>
	);
}
