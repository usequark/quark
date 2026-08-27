"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

const RADIUS = 9;
const CIRC = 2 * Math.PI * RADIUS;

// Visual properties driven entirely by CSS variables — see globals.css
// [data-toast-variant] selectors override --toast-bg, --toast-border, --toast-text, --toast-shadow

export function Toast({
	message,
	variant = "default",
	onClose,
	visible = true,
	duration = 4000,
	_toastId,
}) {
	const [progress, setProgress] = useState(100);
	const [hovered, setHovered] = useState(false);
	const [isAnimatingOut, setIsAnimatingOut] = useState(false);
	const [shouldRender, setShouldRender] = useState(visible);

	const variantCls =
		"bg-[--toast-bg] border-[--toast-border] text-[--toast-text] shadow-[var(--toast-shadow)]";

	const remainingRef = useRef(duration);
	const startRef = useRef(null);
	const intervalRef = useRef(null);
	const isClosingRef = useRef(false);

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

	useEffect(() => {
		if (visible) {
			setShouldRender(true);
			setIsAnimatingOut(false);
			isClosingRef.current = false;
			remainingRef.current = duration;
			setProgress(100);
			setHovered(false);
			start();
		} else {
			if (isClosingRef.current) return;
			isClosingRef.current = true;
			setIsAnimatingOut(true);
			stop();
			// Wait for animation to finish before removing from DOM
			const t = setTimeout(() => {
				setShouldRender(false);
				setIsAnimatingOut(false);
				isClosingRef.current = false;
			}, 200);
			return () => clearTimeout(t);
		}
		return stop;
	}, [visible, duration, start, stop]);

	useEffect(() => {
		if (!visible || isAnimatingOut) return;
		if (hovered) {
			stop();
		} else {
			remainingRef.current = duration;
			start();
		}
	}, [hovered, duration, start, stop, visible, isAnimatingOut]);

	if (!shouldRender) return null;

	const dashOffset = CIRC * (1 - progress / 100);

	const animStyle = isAnimatingOut
		? { animation: "quark-toast-out 0.2s ease-in forwards" }
		: {
				animation:
					"quark-toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
			};

	return React.createElement(
		"div",
		{
			role: "alert",
			"aria-live": "assertive",
			"data-toast-variant": variant,
			onMouseEnter: () => setHovered(true),
			onMouseLeave: () => setHovered(false),
			className: `fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-[--radius-default] px-4 py-3 text-sm transition-colors duration-200 ${variantCls}`,
			style: animStyle,
		},
		React.createElement("span", null, message),
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
								"flex h-6 w-6 cursor-pointer items-center justify-center rounded-[--radius-default] text-base leading-none opacity-80 transition-all hover:bg-black/10 dark:hover:bg-white/10 hover:opacity-100 active:bg-black/20 dark:active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
						},
						React.createElement(
							"svg",
							{
								width: 10,
								height: 10,
								viewBox: "0 0 10 10",
								"aria-hidden": "true",
								fill: "none",
								className: "shrink-0",
							},
							React.createElement("path", {
								d: "M1 1L9 9",
								stroke: "currentColor",
								strokeWidth: 1.5,
								strokeLinecap: "round",
							}),
							React.createElement("path", {
								d: "M9 1L1 9",
								stroke: "currentColor",
								strokeWidth: 1.5,
								strokeLinecap: "round",
							}),
						),
					)
				: React.createElement(
						"svg",
						{
							width: 24,
							height: 24,
							viewBox: "0 0 24 24",
							"aria-hidden": "true",
						},
						React.createElement("circle", {
							cx: 12,
							cy: 12,
							r: RADIUS,
							fill: "none",
							stroke: "currentColor",
							strokeOpacity: 0.2,
							strokeWidth: 2,
						}),
						React.createElement("circle", {
							cx: 12,
							cy: 12,
							r: RADIUS,
							fill: "none",
							stroke: "currentColor",
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
