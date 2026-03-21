"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Toast — fixed bottom-right notification with auto-dismiss countdown.
 *
 * Props:
 *   message   (string)                        — notification text
 *   variant   ('default'|'success'|'error')   — colour scheme
 *   onClose   (fn)                            — called when dismissed / expired
 *   visible   (bool)                          — controlled visibility
 *   duration  (number)                        — ms before auto-dismiss (default 4000)
 *   toastId   (number)                        — incremented by useToast on each show()
 *                                               so the timer resets correctly
 *
 * Features:
 *   • SVG circle progress shows remaining time
 *   • Hovering pauses the timer and replaces the circle with a × close button
 */

const RADIUS = 9;
const CIRC = 2 * Math.PI * RADIUS; // ≈ 56.55

const VARIANTS = {
	default:
		"border border-gray-700 dark:border-[#1e2535] bg-gray-900 dark:bg-[#090d14] text-white dark:text-[#e0e0e0]",
	success:
		"border border-green-500 dark:border-emerald-800/50 bg-green-600 dark:bg-[#090d14] text-white dark:text-emerald-400",
	error:
		"border border-red-500 dark:border-[#ff4757]/40 bg-red-600 dark:bg-[#090d14] text-white dark:text-[#ff4757]",
};

export function Toast({
	message,
	variant = "default",
	onClose,
	visible = true,
	duration = 4000,
	_toastId,
}) {
	const [progress, setProgress] = useState(100); // 100 → 0 as time elapses
	const [hovered, setHovered] = useState(false);

	const variantCls = VARIANTS[variant] ?? VARIANTS.default;

	// Mutable refs so the interval callback always reads fresh values
	const remainingRef = useRef(duration);
	const startRef = useRef(null);
	const intervalRef = useRef(null);

	const stop = useCallback(() => clearInterval(intervalRef.current), []);

	const start = useCallback(() => {
		stop();
		startRef.current = Date.now();
		intervalRef.current = setInterval(() => {
			const elapsed = Date.now() - startRef.current;
			const pct = Math.max(0, 100 - (elapsed / remainingRef.current) * 100);
			setProgress(pct);
			if (pct <= 0) {
				stop();
				onClose?.();
			}
		}, 16);
	}, [stop, onClose]);

	// Reset when toast becomes visible or a new toast is shown (toastId changes)
	useEffect(() => {
		if (!visible) {
			stop();
			setProgress(100);
			return;
		}
		remainingRef.current = duration;
		setProgress(100);
		setHovered(false);
		start();
		return stop;
	}, [visible, duration, start, stop]);

	// Pause on hover, RESET on leave (restart from full duration)
	useEffect(() => {
		if (!visible) return;
		if (hovered) {
			stop();
		} else {
			// Reset to full duration on every mouse-leave
			remainingRef.current = duration;
			start();
		}
	}, [hovered, duration, start, stop, visible]);

	if (!visible) return null;

	const dashOffset = CIRC * (1 - progress / 100);

	return React.createElement(
		"div",
		{
			role: "alert",
			"aria-live": "assertive",
			"data-toast-variant": variant,
			onMouseEnter: () => setHovered(true),
			onMouseLeave: () => setHovered(false),
			className: `fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded px-4 py-3 text-sm shadow-xl transition-all duration-200 ${variantCls}`,
		},
		React.createElement("span", null, message),
		// Trailing indicator: × when hovered, progress circle otherwise
		React.createElement(
			"div",
			{
				className:
					"relative ml-2 flex h-6 w-6 shrink-0 items-center justify-center",
			},
			hovered
				? React.createElement(
						"button",
						{
							type: "button",
							"aria-label": "Dismiss notification",
							onClick: onClose,
							className:
								"flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm text-base leading-none opacity-80 transition-all hover:bg-white/15 hover:opacity-100 active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
						},
						"\u00d7",
					)
				: React.createElement(
						"svg",
						{
							width: 24,
							height: 24,
							viewBox: "0 0 24 24",
							"aria-hidden": "true",
						},
						// Track ring
						React.createElement("circle", {
							cx: 12,
							cy: 12,
							r: RADIUS,
							fill: "none",
							stroke: "var(--quark-toast-track)",
							strokeWidth: 2,
						}),
						// Progress arc
						React.createElement("circle", {
							cx: 12,
							cy: 12,
							r: RADIUS,
							fill: "none",
							stroke: "var(--quark-toast-progress)",
							strokeWidth: 2,
							strokeLinecap: "round",
							strokeDasharray: CIRC,
							strokeDashoffset: dashOffset,
							style: { transform: "rotate(-90deg)", transformOrigin: "center" },
						}),
					),
		),
	);
}

/**
 * useToast — manages toast state and exposes a stable show() / hide() API.
 *
 * Usage:
 *   const { show, hide, toastProps } = useToast();
 *   <Toast {...toastProps} />
 *
 *   show("Saved!", "success");
 *   show("Oops", "error", 6000);  // custom duration
 */
export function useToast() {
	const [state, setState] = useState({
		visible: false,
		message: "",
		variant: "default",
		duration: 4000,
		toastId: 0,
	});

	const show = useCallback(
		(message, variant = "default", duration = 4000) =>
			setState((s) => ({
				visible: true,
				message,
				variant,
				duration,
				toastId: s.toastId + 1,
			})),
		[],
	);

	const hide = useCallback(
		() => setState((s) => ({ ...s, visible: false })),
		[],
	);

	return { show, hide, toastProps: { ...state, onClose: hide } };
}
