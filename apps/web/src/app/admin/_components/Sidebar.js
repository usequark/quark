"use client";

import { QuarkLogo } from "@techstream/quark-ui";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AdminThemeToggle from "./AdminThemeToggle";
import SignOutButton from "./SignOutButton";

/**
 * @param {{
 *   title: string,
 *   models: { name: string, slug: string, label: string, readOnly: boolean }[],
 *   customLinks?: { href: string, label: string, icon?: import('react').ReactNode }[],
 *   contentLinks?: { href: string, label: string }[],
 *   hasCms?: boolean,
 *   userRole?: string
 * }} props
 */
export default function Sidebar({
	title,
	models,
	customLinks = [],
	contentLinks = [],
	hasCms = false,
	userRole = "admin",
}) {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	const coreModels = models.filter((m) => !m.readOnly);
	const systemModels = models.filter((m) => m.readOnly);
	const isCmsOnly = hasCms && userRole === "editor";
	const isClientAdmin = userRole === "client_admin";

	/**
	 * Render a nav link. Uses exact matching for the root admin and CMS overview
	 * to prevent both from highlighting when on a sub-page.
	 * All other links match if the pathname equals or starts with `href/`.
	 */
	function navLink(href, label, icon, exact = false) {
		const isExact = exact || href === "/admin" || href === "/admin/cms";
		const isActive = isExact
			? pathname === href
			: pathname === href || pathname.startsWith(`${href}/`);
		return (
			<a
				key={href}
				href={href}
				onClick={() => setOpen(false)}
				className={`flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm transition-colors ${
					isActive
						? "bg-surface-hover text-text border-l-2 border-primary -ml-px"
						: "text-text-muted hover:bg-surface-hover hover:text-text"
				}`}
			>
				{icon}
				{label}
			</a>
		);
	}

	const sidebar = (
		<aside className="h-full w-56 shrink-0 bg-surface border-r border-border p-4 flex flex-col">
			{/* Header */}
			<div className="mb-4 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<QuarkLogo size={24} />
					<a
						href={isCmsOnly ? "/admin/cms" : "/admin"}
						className="text-lg font-semibold text-text hover:text-text-muted"
					>
						{title}
					</a>
				</div>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="p-1 rounded-[--radius-default] text-text-muted hover:text-text hover:bg-surface-hover lg:hidden"
					aria-label="Close menu"
				>
					<svg
						aria-hidden="true"
						className="w-5 h-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			{/* Dashboard — hidden for editor-only mode */}
			{!isCmsOnly && (
				<nav className="flex flex-col gap-1 mb-3 shrink-0">
					{navLink(
						"/admin",
						"Dashboard",
						<svg
							aria-hidden="true"
							className="w-4 h-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
							/>
						</svg>,
					)}
				</nav>
			)}

			{customLinks.length > 0 && (
				<>
					<div className="border-t border-border mb-3 shrink-0" />
					<nav className="flex flex-col gap-1 mb-3 shrink-0">
						{customLinks.map((link) =>
							navLink(link.href, link.label, link.icon ?? null),
						)}
					</nav>
				</>
			)}

			{contentLinks.length > 0 && (
				<>
					<div className="border-t border-border mb-3 shrink-0" />
					<div className="shrink-0">
						<p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-faint">
							Content
						</p>
						<nav className="flex flex-col gap-0.5 mb-3">
							{navLink("/admin/cms", "Overview")}
							{contentLinks.map((link) => navLink(link.href, link.label))}
							{navLink("/admin/cms/media", "Media")}
						</nav>
					</div>
				</>
			)}

			{/* Scrollable model sections — hidden for client_admin and editors */}
			{!isCmsOnly && !isClientAdmin && (
				<>
					<div className="border-t border-border mb-3 shrink-0" />
					<div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
						{coreModels.length > 0 && (
							<ModelSection
								label="Models"
								models={coreModels}
								navLink={navLink}
							/>
						)}
						{coreModels.length > 0 && systemModels.length > 0 && (
							<div className="border-t border-border" />
						)}
						{systemModels.length > 0 && (
							<ModelSection
								label="System"
								models={systemModels}
								navLink={navLink}
							/>
						)}
					</div>
				</>
			)}

			{isCmsOnly && <div className="flex-1" />}

			{/* Footer */}
			<div className="border-t border-border pt-3 mt-3 flex flex-col gap-1 shrink-0">
				<AdminThemeToggle />
				<a
					href="/"
					className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-colors"
				>
					Back to Home
				</a>
				<SignOutButton />
			</div>
		</aside>
	);

	return (
		<>
			{/* Mobile/tablet/small-desktop menu button */}
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="group fixed top-3 left-3 z-40 p-2 rounded-[--radius-default] bg-surface border border-border text-text-muted hover:text-text hover:scale-105 active:scale-95 lg:hidden cursor-pointer transition-transform duration-150"
				aria-label="Open menu"
				aria-expanded={open}
				aria-controls="admin-sidebar-overlay"
			>
				<svg
					aria-hidden="true"
					className="w-5 h-5 transition-transform duration-200 group-active:rotate-180"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth="2"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>

			{/* Desktop sidebar */}
			<div className="hidden lg:flex h-full">{sidebar}</div>

			{/* Mobile/tablet/small-desktop overlay */}
			<div
				id="admin-sidebar-overlay"
				className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ${
					open
						? "opacity-100 pointer-events-auto"
						: "opacity-0 pointer-events-none"
				}`}
				aria-hidden={!open}
			>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
				<div
					className="absolute inset-0 bg-black/40"
					onClick={() => setOpen(false)}
					role="presentation"
				/>
				<div
					className={`relative h-full w-56 transition-transform duration-300 ease-out ${
						open ? "translate-x-0" : "-translate-x-full"
					}`}
				>
					{sidebar}
				</div>
			</div>
		</>
	);
}

function ModelSection({ label, models, navLink }) {
	return (
		<div>
			<p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-faint">
				{label}
			</p>
			<nav className="flex flex-col gap-0.5">
				{models.map((model) =>
					navLink(`/admin/${model.slug}`, model.label, null),
				)}
			</nav>
		</div>
	);
}
