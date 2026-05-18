"use client";
import { useTheme } from "@techstream/quark-ui";
import Link from "next/link";
import { useEffect, useState } from "react";

const SECTIONS = [
	{ id: "button", label: "Button" },
	{ id: "badge", label: "Badge" },
	{ id: "form", label: "Form" },
	{ id: "card", label: "Card" },
	{ id: "table", label: "Table" },
	{ id: "skeleton", label: "Skeleton" },
	{ id: "dialog", label: "Dialog" },
	{ id: "toast", label: "Toast" },
	{ id: "sections", label: "Sections" },
	{ id: "navbar-footer", label: "Navbar & Footer" },
	{ id: "animations", label: "Animations" },
];

function NavItem({ id, label, index }) {
	const num = String(index).padStart(2, "0");
	return (
		<a
			href={`#${id}`}
			className="block font-mono uppercase text-[13px] tracking-[0.15em] text-text-faint hover:bg-surface-hover hover:text-text transition-colors px-3 py-2 rounded-[--radius-default]"
			style={{ textDecoration: "none" }}
		>
			{num} · {label}
		</a>
	);
}

function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const [spinKey, setSpinKey] = useState(0);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="flex px-3 py-2 text-sm text-text-faint opacity-50">
				<span>Loading...</span>
			</div>
		);
	}

	const isDark = theme === "dark";

	function handleToggle() {
		setSpinKey((k) => k + 1);
		setTheme(isDark ? "light" : "dark");
	}

	return (
		<button
			type="button"
			className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-colors duration-300 w-full text-left cursor-pointer"
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
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
			<span>{isDark ? "Dark Mode" : "Light Mode"}</span>
		</button>
	);
}

export function Sidebar() {
	return (
		<nav className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-surface p-4 lg:flex">
			<div className="flex-1 overflow-y-auto">
				<p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-faint mt-4">
					Index
				</p>
				<nav className="flex flex-col gap-0.5 mb-3">
					{SECTIONS.map((s, i) => (
						<NavItem key={s.id} id={s.id} label={s.label} index={i + 1} />
					))}
				</nav>
			</div>

			<div className="border-t border-border pt-3 mt-3 flex flex-col gap-1 shrink-0">
				<ThemeToggle />
				<Link
					href="/"
					className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-colors"
				>
					Back to Home
				</Link>
			</div>
		</nav>
	);
}
