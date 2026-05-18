"use client";

import { useEffect, useRef } from "react";

const PALETTES = {
	dark: { r: 255, g: 255, b: 255, maxOpacity: 0.85 },
	light: { r: 20, g: 30, b: 70, maxOpacity: 0.55 },
};

/**
 * BackgroundStars — canvas-based star field where each star shimmers
 * independently using a sine-wave opacity oscillation. Stars are fixed in
 * position; only their brightness changes, giving a quiet night-sky effect.
 *
 * @param {string}          className       — extra CSS classes
 * @param {"dark"|"light"}  variant         — star palette (default "dark")
 * @param {string}          backgroundColor — canvas fill ("transparent" or CSS colour)
 * @param {number}          starCount       — number of stars (default 120)
 * @param {number}          maxSize         — maximum star radius in px (default 1.8)
 */
export function BackgroundStars({
	className = "",
	variant = "dark",
	backgroundColor,
	starCount = 120,
	maxSize = 1.8,
}) {
	const canvasRef = useRef(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;

		const ctx = canvas.getContext("2d");
		if (!ctx) return undefined;

		const pal = PALETTES[variant] ?? PALETTES.dark;
		const resolvedBg = backgroundColor ?? "transparent";

		let stars = [];
		let animId;
		let resizeObserver;
		let w = 0;
		let h = 0;

		class Star {
			init() {
				this.x = Math.random() * w;
				this.y = Math.random() * h;
				// Smaller stars are more numerous; skew toward the small end.
				this.radius = 0.4 + Math.random() * Math.random() * maxSize;
				this.baseOpacity = 0.08 + Math.random() * pal.maxOpacity;
				// Random starting phase so stars don't all pulse in sync.
				this.phase = Math.random() * Math.PI * 2;
				// Frequency range: ~3s–12s shimmer period at 60fps — slow, gentle twinkle.
				this.frequency = 0.0005 + Math.random() * 0.0018;
				// Amplitude: how far the opacity swings from its base.
				this.amplitude = 0.1 + Math.random() * Math.min(this.baseOpacity, 0.35);
			}

			draw(t) {
				const raw =
					this.baseOpacity +
					Math.sin(this.phase + t * this.frequency) * this.amplitude;
				const opacity = Math.max(0, Math.min(1, raw));
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(${pal.r},${pal.g},${pal.b},${opacity.toFixed(3)})`;
				ctx.fill();
			}
		}

		const resize = () => {
			const container = canvas.parentElement ?? canvas;
			w = container.clientWidth || window.innerWidth;
			h = container.clientHeight || window.innerHeight;
			const dpr = Math.max(1, window.devicePixelRatio || 1);

			canvas.width = Math.floor(w * dpr);
			canvas.height = Math.floor(h * dpr);
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(dpr, dpr);

			stars = Array.from({ length: starCount }, () => {
				const s = new Star();
				s.init();
				return s;
			});
		};

		const animate = (t) => {
			if (resolvedBg === "transparent") {
				ctx.clearRect(0, 0, w, h);
			} else {
				ctx.fillStyle = resolvedBg;
				ctx.fillRect(0, 0, w, h);
			}

			for (const star of stars) {
				star.draw(t);
			}

			animId = requestAnimationFrame(animate);
		};

		window.addEventListener("resize", resize);
		if (canvas.parentElement) {
			resizeObserver = new ResizeObserver(resize);
			resizeObserver.observe(canvas.parentElement);
		}

		resize();
		animId = requestAnimationFrame(animate);

		return () => {
			window.removeEventListener("resize", resize);
			if (resizeObserver) resizeObserver.disconnect();
			cancelAnimationFrame(animId);
		};
	}, [variant, backgroundColor, starCount, maxSize]);

	return (
		<canvas
			ref={canvasRef}
			className={`pointer-events-none absolute inset-0 ${className}`}
		/>
	);
}
