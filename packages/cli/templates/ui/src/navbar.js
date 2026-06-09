"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const shellCls =
	"relative w-full border-b border-border bg-surface/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur";
const mobileShellCls =
	"relative w-full border-b border-border bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";
const mobileShellOpenCls =
	"relative w-full border-b border-transparent bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";
const containerCls = "mx-auto w-full px-4 sm:px-6 lg:px-8";
const desktopInnerCls = "flex h-[4.5rem] items-center justify-center gap-6";
const leftZoneCls = "flex items-center mr-auto";
const rightZoneCls = "flex items-center justify-end ml-auto";
const logoCls =
	"inline-flex items-center gap-2.5 rounded-[--radius-default] px-1.5 py-1 text-base font-semibold tracking-wide text-text transition-colors hover:text-primary";
const markCls =
	"inline-flex h-8 w-8 items-center justify-center rounded-[--radius-default] border border-primary/40 bg-primary-muted text-[11px] font-bold uppercase tracking-widest text-primary";
const centerNavCls = "flex min-w-0 justify-center";
const desktopListCls = "flex items-center gap-3";
const desktopLinkCls =
	"inline-flex h-10 items-center rounded-[--radius-default] px-3.5 text-base font-medium text-text-muted transition-colors hover:bg-surface hover:text-text";

const desktopDropdownWrapCls =
	"group inline-flex cursor-pointer items-center rounded-[--radius-default] transition-colors hover:bg-surface";
const desktopDropdownLinkCls =
	"flex items-center text-base font-medium text-text-muted transition-colors group-hover:text-text";
const desktopDropdownChevronCls =
	"flex items-center px-2 pt-1 text-text-muted transition-colors group-hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-r-[--radius-default]";
const actionCls =
	"inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[--radius-default] border border-primary/55 bg-primary-muted px-5 text-base font-semibold text-primary transition-colors hover:border-primary hover:bg-primary-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

const mobileInnerCls = "flex h-14 items-center justify-between gap-4";
const mobileToggleCls =
	"inline-flex h-10 w-10 items-center justify-center rounded-[--radius-default] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const mobilePanelWrapCls =
	"absolute inset-x-0 top-full z-[80] overflow-y-auto overscroll-contain [touch-action:pan-y] [-webkit-overflow-scrolling:touch] origin-top";
const mobilePanelCls =
	"border-y border-border bg-surface will-change-transform transition-all duration-300 ease-out";
const mobileLinkCls =
	"flex min-h-12 w-full items-center justify-between px-4 text-left text-base font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text";
const mobileSubLinkCls =
	"block px-6 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text";
const mobileActionWrapCls = "px-3 pb-3 pt-2";
const mobileActionCls =
	"inline-flex h-10 w-full items-center justify-center rounded-[--radius-default] border border-primary/55 bg-primary-muted px-4 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

const DEFAULT_LINKS = [
	{ label: "Home", href: "#" },
	{
		label: "Services",
		items: [
			{ label: "Web Development", href: "#" },
			{ label: "Design Systems", href: "#" },
			{ label: "Consulting", href: "#" },
		],
	},
	{ label: "Pricing", href: "#" },
	{
		label: "Company",
		items: [
			{ label: "About", href: "#" },
			{ label: "Careers", href: "#" },
			{ label: "Contact", href: "#" },
		],
	},
];

const DEFAULT_ACTION = { label: "Contact", href: "#" };

function hasSubItems(link) {
	return Array.isArray(link?.items) && link.items.length > 0;
}

function safeLinks(links) {
	return links === undefined
		? DEFAULT_LINKS
		: Array.isArray(links)
			? links
			: [];
}

function renderLogo(logo) {
	if (React.isValidElement(logo)) {
		return logo;
	}

	const text = String(logo ?? "Logo");
	return React.createElement(
		React.Fragment,
		null,
		React.createElement(
			"span",
			{ "aria-hidden": "true", className: markCls },
			text.slice(0, 1),
		),
		React.createElement("span", { className: "text-lg" }, text),
	);
}

function renderAction(action, className = actionCls) {
	if (!action) return null;
	const label = action.label ?? "Action";

	if (action.href) {
		return React.createElement("a", { href: action.href, className }, label);
	}

	return React.createElement(
		"button",
		{ type: "button", className, onClick: action.onClick },
		label,
	);
}

function Chevron({ open = false, className = "h-3.5 w-3.5" }) {
	return React.createElement(
		"svg",
		{
			"aria-hidden": "true",
			viewBox: "0 0 20 20",
			fill: "none",
			className:
				`${className} transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`.trim(),
		},
		React.createElement("path", {
			d: "M5 7.5L10 12.5L15 7.5",
			stroke: "currentColor",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			strokeLinejoin: "round",
		}),
	);
}

export function Navbar({
	className = "",
	logo = "Lorem Ipsum",
	logoHref = "#",
	links = DEFAULT_LINKS,
	action = DEFAULT_ACTION,
	maxWidthClassName = "max-w-6xl",
}) {
	const rootRef = useRef(null);
	const leaveTimerRef = useRef(null);
	const [openIndex, setOpenIndex] = useState(null);
	const navLinks = useMemo(() => safeLinks(links), [links]);
	const toggleDesktopDropdown = (index) => {
		setOpenIndex((state) => (state === index ? null : index));
	};

	useEffect(() => {
		if (openIndex === null) return;

		function onPointerDown(event) {
			if (rootRef.current?.contains(event.target)) return;
			setOpenIndex(null);
		}

		function onEscape(event) {
			if (event.key === "Escape") setOpenIndex(null);
		}

		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onEscape);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onEscape);
		};
	}, [openIndex]);

	return React.createElement(
		"header",
		{
			ref: rootRef,
			className: `${shellCls} ${className}`.trim(),
		},
		React.createElement(
			"div",
			{ className: `${containerCls} ${maxWidthClassName}`.trim() },
			React.createElement(
				"div",
				{ className: desktopInnerCls },
				React.createElement(
					"div",
					{ className: leftZoneCls },
					React.createElement(
						"a",
						{ href: logoHref, className: logoCls },
						renderLogo(logo),
					),
				),
				React.createElement(
					"nav",
					{ className: centerNavCls, "aria-label": "Primary navigation" },
					React.createElement(
						"ul",
						{ className: desktopListCls },
						...navLinks.map((link, index) => {
							if (!hasSubItems(link)) {
								return React.createElement(
									"li",
									{ key: `${link.label}-${index}` },
									React.createElement(
										"a",
										{ href: link.href ?? "#", className: desktopLinkCls },
										link.label,
									),
								);
							}

							const isOpen = openIndex === index;
							return React.createElement(
								"li",
								{
									key: `${link.label}-${index}`,
									className: "relative",
									onMouseEnter: () => {
										if (leaveTimerRef.current)
											clearTimeout(leaveTimerRef.current);
										setOpenIndex(index);
									},
									onMouseLeave: () => {
										leaveTimerRef.current = setTimeout(() => {
											setOpenIndex((state) => (state === index ? null : state));
										}, 150);
									},
								},
								React.createElement(
									"div",
									{ className: desktopDropdownWrapCls },
									React.createElement(
										"a",
										{
											href: link.href ?? "#",
											className: `${desktopDropdownLinkCls} rounded-l-[--radius-default] px-3.5 py-2`,
										},
										link.label,
									),
									React.createElement(
										"button",
										{
											type: "button",
											className: desktopDropdownChevronCls,
											"aria-expanded": isOpen,
											"aria-haspopup": "menu",
											"aria-label": `${link.label} submenu`,
											onClick: () => toggleDesktopDropdown(index),
										},
										React.createElement(Chevron, { open: isOpen }),
									),
								),
								isOpen
									? React.createElement(
											"div",
											{
												role: "menu",
												className:
													"absolute left-0 top-[calc(100%+0.6rem)] z-40 w-48 rounded-[--radius-default] border border-border bg-surface shadow-xl",
											},
											...(link.items ?? []).map((item, itemIndex) =>
												React.createElement(
													"a",
													{
														key: `${item.label}-${itemIndex}`,
														href: item.href ?? "#",
														role: "menuitem",
														className:
															"block rounded-[--radius-default] px-3.5 py-2.5 text-base text-text-muted transition-colors hover:bg-surface-hover hover:text-text",
														onClick: () => setOpenIndex(null),
													},
													item.label,
												),
											),
										)
									: null,
							);
						}),
					),
				),
				React.createElement(
					"div",
					{ className: rightZoneCls },
					renderAction(action),
				),
			),
		),
	);
}

export function MobileNavbar({
	className = "",
	logo = "Lorem Ipsum",
	logoHref = "#",
	links = DEFAULT_LINKS,
	action = DEFAULT_ACTION,
	maxWidthClassName = "max-w-6xl",
}) {
	const rootRef = useRef(null);
	const barRef = useRef(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [isMenuVisible, setIsMenuVisible] = useState(false);
	const [isPanelActive, setIsPanelActive] = useState(false);
	const [openSubmenus, setOpenSubmenus] = useState({});
	const [panelMaxHeight, setPanelMaxHeight] = useState(0);
	const navLinks = useMemo(() => safeLinks(links), [links]);
	const menuAnimatingVisible = menuOpen || isMenuVisible;

	useEffect(() => {
		if (menuOpen) {
			setIsMenuVisible(true);
			let secondFrame = 0;
			const firstFrame = requestAnimationFrame(() => {
				secondFrame = requestAnimationFrame(() => {
					setIsPanelActive(true);
				});
			});
			return () => {
				cancelAnimationFrame(firstFrame);
				if (secondFrame) cancelAnimationFrame(secondFrame);
			};
		}

		setIsPanelActive(false);
		const closeTimer = setTimeout(() => {
			setIsMenuVisible(false);
			setOpenSubmenus({});
		}, 320);
		return () => clearTimeout(closeTimer);
	}, [menuOpen]);

	useEffect(() => {
		if (!menuOpen) return;

		function updatePanelLayout() {
			if (!barRef.current) return;
			const rect = barRef.current.getBoundingClientRect();
			const viewportHeight = window.innerHeight;
			const availableHeight = Math.max(0, viewportHeight - rect.bottom);
			setPanelMaxHeight(availableHeight);
		}

		updatePanelLayout();
		window.addEventListener("resize", updatePanelLayout);
		window.addEventListener("scroll", updatePanelLayout, true);
		return () => {
			window.removeEventListener("resize", updatePanelLayout);
			window.removeEventListener("scroll", updatePanelLayout, true);
		};
	}, [menuOpen]);

	useEffect(() => {
		if (!menuOpen) return;

		function onPointerDown(event) {
			if (rootRef.current?.contains(event.target)) return;
			setMenuOpen(false);
		}

		function onEscape(event) {
			if (event.key === "Escape") {
				setMenuOpen(false);
			}
		}

		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onEscape);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onEscape);
		};
	}, [menuOpen]);

	function toggleSubmenu(index) {
		setOpenSubmenus((state) => ({
			...state,
			[index]: !state[index],
		}));
	}

	return React.createElement(
		"header",
		{
			ref: rootRef,
			className:
				`${menuAnimatingVisible ? mobileShellOpenCls : mobileShellCls} ${className}`.trim(),
		},
		React.createElement(
			"div",
			{ className: `${containerCls} ${maxWidthClassName} relative`.trim() },
			React.createElement(
				"div",
				{ ref: barRef, className: mobileInnerCls },
				React.createElement(
					"a",
					{ href: logoHref, className: logoCls },
					renderLogo(logo),
				),
				React.createElement(
					"button",
					{
						type: "button",
						className: mobileToggleCls,
						"aria-label": menuOpen
							? "Close navigation menu"
							: "Open navigation menu",
						"aria-expanded": menuOpen,
						onClick: () => {
							setMenuOpen((state) => !state);
						},
					},
					React.createElement(
						"span",
						{
							"aria-hidden": "true",
							className: "relative block h-4 w-4",
						},
						React.createElement("span", {
							className: `absolute left-0 top-[2px] block h-[2px] w-4 bg-current transition-all duration-200 ease-out ${
								menuOpen ? "translate-y-[5px] rotate-45" : ""
							}`,
						}),
						React.createElement("span", {
							className: `absolute left-0 top-[7px] block h-[2px] w-4 bg-current transition-all duration-200 ease-out ${
								menuOpen ? "opacity-0" : "opacity-100"
							}`,
						}),
						React.createElement("span", {
							className: `absolute left-0 top-[12px] block h-[2px] w-4 bg-current transition-all duration-200 ease-out ${
								menuOpen ? "-translate-y-[5px] -rotate-45" : ""
							}`,
						}),
					),
				),
			),
			isMenuVisible
				? React.createElement(
						"div",
						{
							className: `${mobilePanelWrapCls} ${
								isPanelActive ? "pointer-events-auto" : "pointer-events-none"
							}`,
							style: {
								maxHeight: `${panelMaxHeight}px`,
								paddingBottom: "env(safe-area-inset-bottom)",
							},
						},
						React.createElement(
							"div",
							{ className: "overflow-visible" },
							React.createElement(
								"nav",
								{
									className: `${mobilePanelCls} ${
										isPanelActive
											? "translate-y-0 opacity-100"
											: "-translate-y-6 opacity-0"
									}`,
									"aria-label": "Mobile navigation",
								},
								React.createElement(
									"ul",
									{ className: "divide-y divide-border" },
									...navLinks.map((link, index) => {
										if (!hasSubItems(link)) {
											return React.createElement(
												"li",
												{ key: `${link.label}-${index}` },
												React.createElement(
													"a",
													{
														href: link.href ?? "#",
														className: mobileLinkCls,
														onClick: () => setMenuOpen(false),
													},
													link.label,
												),
											);
										}

										const submenuOpen = Boolean(openSubmenus[index]);
										return React.createElement(
											"li",
											{ key: `${link.label}-${index}` },
											React.createElement(
												"button",
												{
													type: "button",
													className: mobileLinkCls,
													"aria-expanded": submenuOpen,
													onClick: () => toggleSubmenu(index),
												},
												link.label,
												React.createElement(Chevron, {
													open: submenuOpen,
													className: "h-4 w-4",
												}),
											),
											React.createElement(
												"div",
												{
													className:
														"grid transition-all duration-200 ease-out",
													style: {
														gridTemplateRows: submenuOpen ? "1fr" : "0fr",
														opacity: submenuOpen ? 1 : 0,
													},
												},
												React.createElement(
													"div",
													{ className: "overflow-hidden" },
													React.createElement(
														"ul",
														{ className: "space-y-0 pb-2 pt-1" },
														...(link.items ?? []).map((item, itemIndex) =>
															React.createElement(
																"li",
																{ key: `${item.label}-${itemIndex}` },
																React.createElement(
																	"a",
																	{
																		href: item.href ?? "#",
																		className: mobileSubLinkCls,
																		onClick: () => {
																			setMenuOpen(false);
																			setOpenSubmenus({});
																		},
																	},
																	item.label,
																),
															),
														),
													),
												),
											),
										);
									}),
								),
								action
									? React.createElement(
											"div",
											{ className: mobileActionWrapCls },
											renderAction(action, mobileActionCls),
										)
									: null,
							),
						),
					)
				: null,
		),
	);
}
