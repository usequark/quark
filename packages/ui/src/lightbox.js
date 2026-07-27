"use client";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const BACKDROP_CLS =
	"absolute inset-0 z-0 bg-[--lightbox-backdrop] px-3 py-4 transition-opacity duration-200 ease-out sm:px-6 sm:py-8 cursor-pointer";
const DIALOG_CLS =
	"relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col p-3 transition-all duration-200 ease-out sm:p-5";
const NAV_BTN_CLS =
	"inline-flex items-center gap-1.5 rounded-[--radius-default] border border-[--lightbox-btn-border] px-3 py-1.5 text-sm font-medium text-[--lightbox-btn-text] transition-colors duration-200 hover:bg-[--lightbox-btn-hover-bg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lightbox-btn-ring)] cursor-pointer";
const CLOSE_BTN_CLS =
	"rounded-[--radius-default] border border-[--lightbox-btn-border] px-2 py-1 text-sm font-medium text-[--lightbox-btn-text] transition-colors duration-200 hover:bg-[--lightbox-btn-hover-bg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lightbox-btn-ring)] flex items-center cursor-pointer";

const IMG_CLS =
	"max-h-[72vh] w-auto max-w-full rounded-[--radius-default] object-contain transition-all duration-200 ease-out";

export function Lightbox({
	src,
	alt = "",
	caption = "",
	onClose,
	onPrevious,
	onNext,
	showPrevious = false,
	showNext = false,
	currentIndex = 1,
	totalCount = 1,
	open = false,
	className = "",
}) {
	const [visible, setVisible] = useState(false);
	const closeButtonRef = useRef(null);

	useEffect(() => {
		if (!open) {
			setVisible(false);
			return;
		}
		const frame = requestAnimationFrame(() => setVisible(true));
		return () => cancelAnimationFrame(frame);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	useEffect(() => {
		if (!open || !visible) return;
		closeButtonRef.current?.focus();
	}, [open, visible]);

	useEffect(() => {
		if (!open) return;
		function handleKeyDown(e) {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose?.();
			} else if (e.key === "ArrowLeft" && onPrevious) {
				e.preventDefault();
				onPrevious();
			} else if (e.key === "ArrowRight" && onNext) {
				e.preventDefault();
				onNext();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, onClose, onPrevious, onNext]);

	if (!open) return null;

	const visibleCls = visible ? "opacity-100" : "opacity-0";
	const visibleTransformCls = visible
		? "translate-y-0 opacity-100"
		: "translate-y-2 opacity-0";
	const visibleScaleCls = visible
		? "scale-100 opacity-100"
		: "scale-95 opacity-0";

	const dialogChildren = [
		React.createElement(
			"div",
			{
				key: "header",
				className: "mb-3 flex items-center justify-between gap-3",
			},
			React.createElement("span", { key: "spacer" }),
			React.createElement(
				"button",
				{
					key: "close",
					type: "button",
					ref: closeButtonRef,
					onClick: onClose,
					className: CLOSE_BTN_CLS,
				},
				React.createElement(X, { className: "size-4", "aria-hidden": true }),
			),
		),
		React.createElement(
			"div",
			{
				key: "image",
				className: "flex min-h-0 flex-1 items-center justify-center",
			},
			React.createElement("img", {
				src,
				alt,
				className: `${IMG_CLS} ${visibleScaleCls}`,
			}),
		),
	];

	if (caption) {
		dialogChildren.push(
			React.createElement(
				"p",
				{
					key: "caption",
					className: "mt-3 text-sm leading-6 text-[--lightbox-caption-text]",
				},
				caption,
			),
		);
	}

	if (showPrevious || showNext) {
		const navChildren = [];
		if (showPrevious) {
			navChildren.push(
				React.createElement(
					"button",
					{
						key: "prev",
						type: "button",
						onClick: onPrevious,
						className: NAV_BTN_CLS,
					},
					React.createElement(ChevronLeft, {
						className: "size-4",
						"aria-hidden": true,
					}),
					" Previous",
				),
			);
		}
		if (totalCount > 1) {
			navChildren.push(
				React.createElement(
					"p",
					{
						key: "counter",
						className:
							"min-w-16 text-center font-mono text-xs uppercase tracking-[0.16em] text-[--lightbox-counter-text]",
					},
					`${currentIndex} / ${totalCount}`,
				),
			);
		}
		if (showNext) {
			navChildren.push(
				React.createElement(
					"button",
					{
						key: "next",
						type: "button",
						onClick: onNext,
						className: NAV_BTN_CLS,
					},
					"Next ",
					React.createElement(ChevronRight, {
						className: "size-4",
						"aria-hidden": true,
					}),
				),
			);
		}
		dialogChildren.push(
			React.createElement(
				"div",
				{
					key: "nav",
					className: "mt-4 flex items-center justify-center gap-2",
				},
				...navChildren,
			),
		);
	}

	return React.createElement(
		"div",
		{ className: `fixed inset-0 z-[90] ${className}`.trim() },
		React.createElement("button", {
			type: "button",
			"aria-label": "Close lightbox",
			className: `${BACKDROP_CLS} ${visibleCls}`,
			onClick: onClose,
		}),
		React.createElement(
			"div",
			{
				role: "dialog",
				"aria-modal": true,
				"aria-label": alt || "Image lightbox",
				className: `${DIALOG_CLS} ${visibleTransformCls}`,
			},
			...dialogChildren,
		),
	);
}
