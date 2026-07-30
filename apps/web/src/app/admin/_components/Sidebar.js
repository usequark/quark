"use client";

import { QuarkLogo } from "@techstream/quark-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
	const [collapsed, setCollapsed] = useState(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("admin-sidebar-collapsed") === "true";
		}
		return false;
	});
	useEffect(() => {
		localStorage.setItem("admin-sidebar-collapsed", String(collapsed));
	}, [collapsed]);

	const coreModels = models.filter((m) => !m.readOnly);
	const systemModels = models.filter((m) => m.readOnly);
	const isCmsOnly = hasCms && userRole === "editor";
	const isClientAdmin = userRole === "client_admin";

	/**
	 * Create a navLink function bound to a specific collapse state.
	 * This ensures mobile overlay always renders expanded even if desktop is collapsed.
	 */
	function createNavLink(isCollapsed) {
		return function navLink(href, label, icon, exact = false) {
			const isExact = exact || href === "/admin" || href === "/admin/cms";
			const isActive = isExact
				? pathname === href
				: pathname === href || pathname.startsWith(`${href}/`);
			return (
				<Link
					key={href}
					href={href}
					onClick={() => setOpen(false)}
					className={`flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm transition-all duration-150 ${
						isActive
							? "bg-surface-hover text-text border-l-2 border-primary -ml-px"
							: "text-text-muted hover:bg-surface-hover hover:text-text"
					}`}
					title={isCollapsed ? label : undefined}
				>
					{icon}
					<span
						className={`whitespace-nowrap transition-opacity duration-200 ${
							isCollapsed ? "opacity-0" : "opacity-100"
						}`}
					>
						{label}
					</span>
				</Link>
			);
		};
	}

	function renderSidebarContent(isCollapsed) {
		const navLink = createNavLink(isCollapsed);

		return (
			<aside
				className={`h-full ${
					isCollapsed ? "w-[72px]" : "w-56"
				} shrink-0 bg-surface border-r border-border p-4 flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden`}
				onClick={(e) => {
					if (isCollapsed && e.target === e.currentTarget) {
						setCollapsed(false);
					}
				}}
				onKeyDown={(e) => {
					if (
						isCollapsed &&
						e.target === e.currentTarget &&
						(e.key === "Enter" || e.key === " ")
					) {
						e.preventDefault();
						setCollapsed(false);
					}
				}}
			>
				{/* Header */}
				<div
					className={`mb-4 flex items-center gap-2 ${
						isCollapsed ? "justify-center" : "px-3"
					}`}
				>
					{!isCollapsed && <QuarkLogo size={24} />}
					{!isCollapsed && (
						<Link
							href={isCmsOnly ? "/admin/cms" : "/admin"}
							className="text-lg font-semibold text-text hover:text-text-muted whitespace-nowrap"
						>
							{title}
						</Link>
					)}
					{/* Close button - mobile/tablet only */}
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
					{/* Collapse chevron - desktop only */}
					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className={`p-2 rounded-[--radius-default] text-text-muted hover:bg-surface-hover hover:text-text cursor-pointer transition-all duration-150 hidden lg:flex ${
							isCollapsed ? "" : "ml-auto"
						}`}
						aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
					>
						<svg
							aria-hidden="true"
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d={isCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"}
							/>
						</svg>
					</button>
				</div>

				{/* Dashboard - hidden for editor-only mode */}
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

				{!isCollapsed && customLinks.length > 0 && (
					<div className="border-t border-border mb-3 shrink-0" />
				)}

				{/* Custom links (e.g. Projects) */}
				{customLinks.length > 0 && (
					<nav className="flex flex-col gap-1 mb-3 shrink-0">
						{customLinks.map((link) =>
							navLink(link.href, link.label, link.icon ?? null),
						)}
					</nav>
				)}

				{!isCollapsed && contentLinks.length > 0 && (
					<div className="border-t border-border mb-3 shrink-0" />
				)}

				{/* Content section (CMS) */}
				{contentLinks.length > 0 && (
					<div className="shrink-0">
						{!isCollapsed && (
							<p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-faint">
								Content
							</p>
						)}
						<nav className="flex flex-col gap-0.5 mb-3">
							{navLink("/admin/cms", "Overview", null, true)}
							{contentLinks.map((link) => navLink(link.href, link.label))}
							{navLink("/admin/cms/media", "Media")}
						</nav>
					</div>
				)}

				{!isCollapsed && !isCmsOnly && !isClientAdmin && (
					<div className="border-t border-border mb-3 shrink-0" />
				)}

				{/* Scrollable model sections - hidden for client_admin and editors */}
				{!isCollapsed ? (
					!isCmsOnly &&
					!isClientAdmin && (
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
					)
				) : (
					<div className="flex-1" />
				)}

				{isCmsOnly && !isCollapsed && <div className="flex-1" />}

				{/* Footer */}
				<div className="border-t border-border pt-3 mt-3 flex flex-col gap-1 shrink-0">
					<AdminThemeToggle collapsed={isCollapsed} />
					<Link
						href="/admin/settings/crm"
						className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-all duration-150"
						title={isCollapsed ? "CRM Settings" : undefined}
					>
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
								d="M3 7h18M3 12h18M3 17h12"
							/>
						</svg>
						<span
							className={`whitespace-nowrap transition-opacity duration-200 ${
								isCollapsed ? "opacity-0" : "opacity-100"
							}`}
						>
							CRM Settings
						</span>
					</Link>
					<Link
						href="/admin/settings/ai-workflows"
						className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-all duration-150"
						title={isCollapsed ? "AI Workflows" : undefined}
					>
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
								d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
							/>
						</svg>
						<span
							className={`whitespace-nowrap transition-opacity duration-200 ${
								isCollapsed ? "opacity-0" : "opacity-100"
							}`}
						>
							AI Workflows
						</span>
					</Link>
					<Link
						href="/admin/settings/ai-tools"
						className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-all duration-150"
						title={isCollapsed ? "AI Tool Permissions" : undefined}
					>
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
								d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						<span
							className={`whitespace-nowrap transition-opacity duration-200 ${
								isCollapsed ? "opacity-0" : "opacity-100"
							}`}
						>
							AI Settings
						</span>
					</Link>
					<Link
						href="/"
						className="flex items-center gap-2 px-3 py-2 rounded-[--radius-default] text-sm text-text-faint hover:bg-surface-hover hover:text-text transition-all duration-150"
						title={isCollapsed ? "Back to Home" : undefined}
					>
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
								d="M10 19l-7-7m0 0l7-7m-7 7h18"
							/>
						</svg>
						<span
							className={`whitespace-nowrap transition-opacity duration-200 ${
								isCollapsed ? "opacity-0" : "opacity-100"
							}`}
						>
							Back to Home
						</span>
					</Link>
					<SignOutButton collapsed={isCollapsed} />
				</div>
			</aside>
		);
	}

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
			<div className="hidden lg:flex h-full">
				{renderSidebarContent(collapsed)}
			</div>

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
					{renderSidebarContent(false)}
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
