"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dialog — centered modal built on the native <dialog> element.
 *
 * Props:
 *   open      (bool)    — controlled open state
 *   onClose   (fn)      — called when the dialog should close
 *   title     (string)  — header text
 *   children            — dialog body content
 *   className (string)  — merged onto the <dialog> element
 *
 * Architecture:
 *   • ALL close paths (header ×, backdrop click, Escape, external button)
 *     flow through the `open` prop → useEffect, which owns the single
 *     animation + el.close() call. handleClose() just calls onClose().
 *   • isClosingRef (ref, not state) prevents the effect from double-firing.
 */

const dialogCls =
	"backdrop:bg-black/50 dark:backdrop:bg-black/70 rounded border border-gray-200 dark:border-[#1e2535] bg-white dark:bg-[#0d1117] p-0 shadow-2xl w-full max-w-lg";

const headerCls =
	"flex items-center justify-between border-b border-gray-200 dark:border-[#1e2535] px-5 py-4";

const titleCls = "text-base font-semibold text-gray-900 dark:text-[#e0e0e0]";

const closeCls =
	"flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-lg text-gray-400 dark:text-[#4a4a6a] transition-colors hover:bg-gray-100 dark:hover:bg-[#1e2535] hover:text-gray-700 dark:hover:text-[#e0e0e0] active:bg-gray-200 dark:active:bg-[#1e2535] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 dark:focus-visible:ring-[#377dff]/40";

const bodyCls = "px-5 py-4 text-gray-700 dark:text-[#6b7a99]";

export function Dialog({ open, onClose, title, children, className = "" }) {
	const ref = useRef(null);
	const [isClosing, setIsClosing] = useState(false);
	const isClosingRef = useRef(false);

	// Single source of truth for open/close — drives both animation and native element
	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		if (open) {
			if (!el.open && typeof el.showModal === "function") el.showModal();
			isClosingRef.current = false;
			setIsClosing(false);
		} else {
			// Play exit animation then close native element — regardless of who triggered close
			if (isClosingRef.current) return; // already animating out, don't double-trigger
			isClosingRef.current = true;
			setIsClosing(true);
			const t = setTimeout(() => {
				if (el.open && typeof el.close === "function") el.close();
				setIsClosing(false);
				isClosingRef.current = false;
			}, 180);
			return () => clearTimeout(t);
		}
	}, [open]);

	// All close-trigger sources just call onClose() — parent sets open=false,
	// which re-runs the effect above and plays the animation.
	const handleClose = useCallback(() => {
		if (!isClosingRef.current) onClose?.();
	}, [onClose]);

	// Backdrop click (target is the <dialog> element itself)
	const handleDialogClick = useCallback(
		(e) => {
			if (e.target === ref.current) handleClose();
		},
		[handleClose],
	);

	// Intercept Escape so we can animate before the native dialog closes
	const handleCancel = useCallback(
		(e) => {
			e.preventDefault();
			handleClose();
		},
		[handleClose],
	);

	const animStyle =
		open || isClosing
			? isClosing
				? { animation: "quark-dialog-out 0.18s ease-in forwards" }
				: { animation: "quark-dialog-in 0.2s ease-out forwards" }
			: {};

	return React.createElement(
		"dialog",
		{
			ref,
			onClick: handleDialogClick,
			onCancel: handleCancel,
			style: animStyle,
			className: `${dialogCls} ${className}`.trim(),
		},
		// Header
		React.createElement(
			"div",
			{ className: headerCls },
			React.createElement("h2", { className: titleCls }, title),
			React.createElement(
				"button",
				{
					type: "button",
					"aria-label": "Close dialog",
					onClick: handleClose,
					className: closeCls,
				},
				"\u00d7",
			),
		),
		// Body
		React.createElement("div", { className: bodyCls }, children),
	);
}
