"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const shellCls =
	"relative w-full border-b border-[--navbar-border] bg-[--navbar-bg] shadow-[var(--navbar-inset-shadow)] backdrop-blur";
const mobileShellCls =
	"relative w-full border-b border-[--navbar-border] bg-[--navbar-mobile-bg] shadow-[var(--navbar-inset-shadow)]";
const mobileShellOpenCls =
	"relative w-full border-b border-transparent bg-[--navbar-mobile-bg] shadow-[var(--navbar-inset-shadow)]";
const containerCls = "mx-auto w-full";
const desktopInnerCls = "flex items-center justify-center gap-6";
const leftZoneCls = "flex items-center mr-auto";
const rightZoneCls = "flex items-center justify-end ml-auto";
const logoCls =
	"inline-flex items-center gap-2.5 rounded-[--radius-default] px-1.5 py-1 font-semibold tracking-wide text-[--navbar-text] transition-colors hover:text-[--navbar-logo-hover]";
const markCls =
	"inline-flex items-center justify-center rounded-[--radius-default] border border-[--navbar-mark-border] bg-[--navbar-mark-bg] font-bold uppercase text-[--navbar-mark-text]";
const centerNavCls = "flex min-w-0 justify-center";
const desktopListCls = "flex items-center gap-3";
const desktopLinkCls =
	"inline-flex items-center rounded-[--radius-default] font-medium text-[--navbar-text-muted] transition-colors hover:bg-[--navbar-hover-bg] hover:text-[--navbar-hover-text]";

const desktopDropdownWrapCls =
	"group inline-flex cursor-pointer items-center rounded-[--radius-default] transition-colors hover:bg-[--navbar-hover-bg]";
const desktopDropdownLinkCls =
	"flex items-center font-medium text-[--navbar-text-muted] transition-colors group-hover:text-[--navbar-hover-text]";
const desktopDropdownChevronCls =
	"flex items-center px-2 pt-1 text-[--navbar-text-muted] transition-colors group-hover:text-[--navbar-hover-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navbar-ring)] rounded-r-[--radius-default]";
const actionCls =
	"inline-flex items-center justify-center whitespace-nowrap rounded-[--radius-default] border border-[--navbar-action-border] bg-[--navbar-action-bg] font-semibold text-[--navbar-action-text] transition-colors hover:border-[--navbar-action-hover-border] hover:bg-[--navbar-action-hover-bg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navbar-ring)]";

const mobileInnerCls = "flex items-center justify-between gap-4";
const mobileToggleCls =
	"inline-flex items-center justify-center rounded-[--radius-default] text-[--navbar-text-muted] transition-colors hover:text-[--navbar-hover-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navbar-ring)]";
const mobilePanelWrapCls =
	"absolute inset-x-0 top-full z-[80] overflow-y-auto overscroll-contain [touch-action:pan-y] [-webkit-overflow-scrolling:touch] origin-top";
const mobilePanelCls =
	"border-y border-[--navbar-border] bg-[--navbar-mobile-panel-bg] will-change-transform transition-all duration-300 ease-out";
const mobileLinkCls =
	"flex w-full items-center justify-between text-left font-medium text-[--navbar-text-muted] transition-colors hover:bg-[--navbar-hover-bg] hover:text-[--navbar-hover-text]";
const mobileSubLinkCls =
	"block text-[--navbar-text-muted] transition-colors hover:bg-[--navbar-hover-bg] hover:text-[--navbar-hover-text]";
const mobileActionWrapCls = "";
const mobileActionCls =
	"inline-flex w-full items-center justify-center rounded-[--radius-default] border border-[--navbar-action-border] bg-[--navbar-action-bg] font-semibold text-[--navbar-action-text] transition-colors hover:border-[--navbar-action-hover-border] hover:bg-[--navbar-action-hover-bg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navbar-ring)]";

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
			{
				"aria-hidden": "true",
				className: markCls,
				style: {
					width: "var(--navbar-mark-width)",
					height: "var(--navbar-mark-height)",
					fontSize: "var(--navbar-mark-font-size)",
					textTransform: "var(--navbar-mark-text-transform)",
					letterSpacing: "var(--navbar-mark-text-tracking)",
				},
			},
			text.slice(0, 1),
		),
		React.createElement("span", { className: "text-lg" }, text),
	);
}

function renderAction(action, className = actionCls) {
	if (!action) return null;
	const label = action.label ?? "Action";

	const actionStyle = {
		height: "var(--navbar-action-height)",
		paddingLeft: "var(--navbar-action-padding-x)",
		paddingRight: "var(--navbar-action-padding-x)",
		fontSize: "var(--navbar-action-font-size)",
	};

	if (action.href) {
		return React.createElement(
			"a",
			{ href: action.href, className, style: actionStyle },
			label,
		);
	}

	return React.createElement(
		"button",
		{ type: "button", className, style: actionStyle, onClick: action.onClick },
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
			{
				className: `${containerCls} ${maxWidthClassName}`.trim(),
				style: {
					paddingLeft: "var(--navbar-container-padding-x)",
					paddingRight: "var(--navbar-container-padding-x)",
				},
			},
			React.createElement(
				"div",
				{
					className: desktopInnerCls,
					style: { height: "var(--navbar-desktop-height)" },
				},
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
										{
											href: link.href ?? "#",
											className: desktopLinkCls,
											style: {
												paddingLeft: "var(--navbar-link-padding-x)",
												paddingRight: "var(--navbar-link-padding-x)",
												height: "var(--navbar-link-height)",
												fontSize: "var(--navbar-link-font-size)",
											},
										},
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
											className: `${desktopDropdownLinkCls} rounded-l-[--radius-default]`,
											style: {
												paddingLeft: "var(--navbar-link-padding-x)",
												paddingRight: "var(--navbar-link-padding-x)",
												paddingTop: "0.5rem",
												paddingBottom: "0.5rem",
												fontSize: "var(--navbar-link-font-size)",
											},
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
													"absolute left-0 top-[calc(100%+0.6rem)] z-40 rounded-[--radius-default] border border-[--navbar-border] bg-[--navbar-dropdown-bg] shadow-[var(--navbar-dropdown-shadow)]",
												style: { width: "var(--navbar-dropdown-width)" },
											},
											...(link.items ?? []).map((item, itemIndex) =>
												React.createElement(
													"a",
													{
														key: `${item.label}-${itemIndex}`,
														href: item.href ?? "#",
														role: "menuitem",
														className:
															"block rounded-[--radius-default] text-[--navbar-text-muted] transition-colors hover:bg-[--navbar-hover-bg] hover:text-[--navbar-hover-text]",
														style: {
															paddingLeft:
																"var(--navbar-dropdown-item-padding-x)",
															paddingRight:
																"var(--navbar-dropdown-item-padding-x)",
															paddingTop:
																"var(--navbar-dropdown-item-padding-y)",
															paddingBottom:
																"var(--navbar-dropdown-item-padding-y)",
															fontSize: "var(--navbar-dropdown-item-font-size)",
														},
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
			{
				className: `${containerCls} ${maxWidthClassName} relative`.trim(),
				style: {
					paddingLeft: "var(--navbar-container-padding-x)",
					paddingRight: "var(--navbar-container-padding-x)",
				},
			},
			React.createElement(
				"div",
				{
					ref: barRef,
					className: mobileInnerCls,
					style: { height: "var(--navbar-mobile-height)" },
				},
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
						style: {
							width: "var(--navbar-mobile-toggle-width)",
							height: "var(--navbar-mobile-toggle-height)",
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
									{ className: "divide-y divide-[--navbar-divide-border]" },
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
														style: {
															minHeight: "var(--navbar-mobile-link-min-height)",
															paddingLeft:
																"var(--navbar-mobile-link-padding-x)",
															paddingRight:
																"var(--navbar-mobile-link-padding-x)",
															fontSize: "var(--navbar-mobile-link-font-size)",
														},
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
													style: {
														minHeight: "var(--navbar-mobile-link-min-height)",
														paddingLeft: "var(--navbar-mobile-link-padding-x)",
														paddingRight: "var(--navbar-mobile-link-padding-x)",
														fontSize: "var(--navbar-mobile-link-font-size)",
													},
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
																		style: {
																			paddingLeft:
																				"var(--navbar-mobile-sublink-padding-x)",
																			paddingRight:
																				"var(--navbar-mobile-sublink-padding-x)",
																			paddingTop:
																				"var(--navbar-mobile-sublink-padding-y)",
																			paddingBottom:
																				"var(--navbar-mobile-sublink-padding-y)",
																			fontSize:
																				"var(--navbar-mobile-sublink-font-size)",
																		},
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
											{
												className: mobileActionWrapCls,
												style: {
													paddingLeft: "var(--navbar-container-padding-x)",
													paddingRight: "var(--navbar-container-padding-x)",
													paddingTop: "0.5rem",
													paddingBottom: "0.75rem",
												},
											},
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
