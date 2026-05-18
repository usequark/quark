"use client";

import { useEffect, useRef } from "react";

const PALETTES = {
	dark: { r: 215, g: 212, b: 222 },
	light: { r: 58, g: 52, b: 78 },
};

/**
 * BackgroundStreaks — canvas-based paint-stroke texture. Each stroke is drawn
 * as a horizontal brush mark that tapers naturally from a sharp point at both
 * ends to its full width at the centre (sine envelope), with organic wobbly
 * edges that breathe independently over time. Strokes vary freely in length,
 * thickness, and position, and drift very slowly across the surface. The
 * heavy layering of many low-opacity strokes builds a deep, tactile texture.
 *
 * Use `variant="dark"` for pale strokes over a near-black surface.
 * Use `variant="light"` for subtle dark strokes on a bright background.
 *
 * @param {string}          className       — extra CSS classes
 * @param {"dark"|"light"}  variant         — colour palette (default "dark")
 * @param {string}          backgroundColor — canvas base fill; defaults to "#090909"
 *                                            for dark and "transparent" for light
 * @param {number}          layerCount      — number of overlapping strokes (default 80)
 */
export function BackgroundStreaks({
	className = "",
	variant = "dark",
	backgroundColor,
	layerCount = 80,
}) {
	const canvasRef = useRef(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;

		const ctx = canvas.getContext("2d");
		if (!ctx) return undefined;

		const pal = PALETTES[variant] ?? PALETTES.dark;
		const resolvedBg =
			backgroundColor ?? (variant === "dark" ? "#090909" : "transparent");

		let strokes = [];
		let animId;
		let resizeObserver;
		let w = 0;
		let h = 0;

		class Stroke {
			init(spread = false) {
				// Variable length — short dabs through to long sweeping strokes.
				this.len = w * (0.08 + Math.random() * 0.62);
				// Max half-width at the stroke centre.
				this.maxHW = 1.5 + Math.random() * 11;
				// Very slight lean — strokes stay paint-like, not spotlight-like.
				this.angle = (Math.random() - 0.5) * 0.14;
				// Low opacity per stroke; depth emerges from accumulation.
				this.opacity = 0.022 + Math.random() * 0.06;
				// Slow independent drift — mostly horizontal, tiny vertical float.
				this.vx = (Math.random() - 0.5) * 0.018;
				this.vy = (Math.random() - 0.5) * 0.007;
				// Organic edge wobble.
				this.wobbleAmp = 0.4 + Math.random() * 2.2;
				this.wobbleFreq = 0.014 + Math.random() * 0.022;
				this.wobblePhase = Math.random() * Math.PI * 2;
				// Slow independent phase drift — each stroke breathes on its own.
				this.wobbleDrift = (Math.random() - 0.5) * 0.00025;
				// Slight per-stroke tonal variation.
				this.dr = Math.round((Math.random() - 0.5) * 26);
				this.dg = Math.round((Math.random() - 0.5) * 26);
				this.db = Math.round((Math.random() - 0.5) * 26);

				if (spread) {
					this.cx = Math.random() * (w + this.len) - this.len / 2;
					this.cy = Math.random() * h;
				} else {
					this.cx = this.vx >= 0 ? -this.len / 2 : w + this.len / 2;
					this.cy = Math.random() * h;
				}
			}

			update() {
				this.cx += this.vx;
				this.cy += this.vy;
				this.wobblePhase += this.wobbleDrift;
				const mx = this.len / 2 + 20;
				const my = this.maxHW * 3;
				if (this.cx > w + mx) this.cx = -mx;
				if (this.cx < -mx) this.cx = w + mx;
				if (this.cy > h + my) this.cy = -my;
				if (this.cy < -my) this.cy = h + my;
			}

			draw() {
				const r = Math.min(255, Math.max(0, pal.r + this.dr));
				const g = Math.min(255, Math.max(0, pal.g + this.dg));
				const b = Math.min(255, Math.max(0, pal.b + this.db));

				ctx.save();
				ctx.translate(this.cx, this.cy);
				ctx.rotate(this.angle);

				// Sample every 4px along the stroke length for a smooth path.
				const steps = Math.max(4, Math.ceil(this.len / 4));
				const halfLen = this.len / 2;

				ctx.beginPath();
				// Top edge — left to right.
				// The sine envelope (sin(π·i/steps)) tapers width to zero at both tips,
				// exactly matching a natural brush-stroke profile.
				for (let i = 0; i <= steps; i++) {
					const x = -halfLen + (i / steps) * this.len;
					const env = Math.sin((Math.PI * i) / steps);
					const halfW = this.maxHW * env;
					const wobble =
						this.wobbleAmp *
						env *
						Math.sin(x * this.wobbleFreq + this.wobblePhase);
					const y = -halfW + wobble;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				// Bottom edge — right to left.
				for (let i = steps; i >= 0; i--) {
					const x = -halfLen + (i / steps) * this.len;
					const env = Math.sin((Math.PI * i) / steps);
					const halfW = this.maxHW * env;
					const wobble =
						this.wobbleAmp *
						env *
						Math.sin(x * this.wobbleFreq + this.wobblePhase + Math.PI * 0.7);
					const y = halfW + wobble;
					ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.fillStyle = `rgba(${r},${g},${b},${this.opacity.toFixed(4)})`;
				ctx.fill();
				ctx.restore();
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

			// Reinitialise so stroke lengths scale correctly to the new canvas width.
			strokes = Array.from({ length: layerCount }, () => {
				const s = new Stroke();
				s.init(true);
				return s;
			});
		};

		const animate = () => {
			if (resolvedBg === "transparent") {
				ctx.clearRect(0, 0, w, h);
			} else {
				ctx.fillStyle = resolvedBg;
				ctx.fillRect(0, 0, w, h);
			}

			for (const s of strokes) {
				s.update();
				s.draw();
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
	}, [variant, backgroundColor, layerCount]);

	return (
		<canvas
			ref={canvasRef}
			className={`pointer-events-none absolute inset-0 ${className}`}
		/>
	);
}
