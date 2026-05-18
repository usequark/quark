"use client";

import { useEffect, useRef } from "react";

const PALETTES = {
	dark: { r: 200, g: 210, b: 235, opacity: 0.22 },
	light: { r: 30, g: 50, b: 110, opacity: 0.13 },
};

/**
 * BackgroundGrid — canvas-based line grid with an expanding circular ripple.
 * Each cycle, a ring originates at the canvas centre and radiates outward,
 * slightly pushing grid-line points radially as it passes through them. Two
 * rings run with staggered phases so the animation is continuous. The ring
 * amplitude fades as it nears the canvas edge so it disappears cleanly.
 *
 * @param {string}          className       — extra CSS classes
 * @param {"dark"|"light"}  variant         — line colour palette (default "light")
 * @param {string}          backgroundColor — canvas fill ("transparent" or CSS colour)
 * @param {number}          spacing         — grid cell size in px (default 30)
 * @param {number}          lineWidth       — stroke width in px (default 0.7)
 */
export function BackgroundGrid({
	className = "",
	variant = "light",
	backgroundColor,
	spacing = 30,
	lineWidth = 0.7,
}) {
	const canvasRef = useRef(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;

		const ctx = canvas.getContext("2d");
		if (!ctx) return undefined;

		const pal = PALETTES[variant] ?? PALETTES.light;
		const resolvedBg = backgroundColor ?? "transparent";

		let animId;
		let resizeObserver;
		let w = 0;
		let h = 0;
		// Distance from canvas centre to the farthest corner — computed in resize().
		let maxR = 1;
		// Track elapsed time from the first frame so ring phases are always
		// deterministic regardless of when the component mounts.
		let startTime = null;

		// Two rings travel outward simultaneously with staggered start phases so
		// the animation is always in motion. Each ring is a gaussian bell at the
		// current ring radius; the bell pushes grid points radially outward as it
		// passes, then they settle back — exactly like a water ripple.
		const NUM_RINGS = 2;
		const RING_DURATION = 2500; // ms for a ring to travel centre → edge (controls speed)
		const TOTAL_CYCLE = 12000; // ms between each ring start — increase for fewer ripples
		const RING_WIDTH = 40; // gaussian sigma in px — ring thickness
		const AMPLITUDE = 7; // max radial displacement in px at the ring crest
		const STEP = 4; // px between path sample points along each line

		// Returns total radial displacement for a point `dist` px from centre.
		const getDisp = (elapsed, dist) => {
			const speed = maxR / RING_DURATION;
			let total = 0;
			for (let i = 0; i < NUM_RINGS; i++) {
				// Each ring has its own phase offset within the full cycle.
				const cycleTime =
					(elapsed + (i * TOTAL_CYCLE) / NUM_RINGS) % TOTAL_CYCLE;
				// Ring is only active during its travel window; silent for the rest.
				if (cycleTime >= RING_DURATION) continue;
				const radius = cycleTime * speed;
				// Gaussian bell: max at ring centre, falls off with sigma=RING_WIDTH.
				const norm = (dist - radius) / RING_WIDTH;
				const gauss = Math.exp(-norm * norm);
				// Fade amplitude to zero as the ring reaches the canvas edge.
				const fade = 1 - radius / maxR;
				total += AMPLITUDE * fade * gauss;
			}
			return total;
		};

		// Draw one grid line (horizontal or vertical) with radial ripple displacement.
		const drawLine = (elapsed, isHorizontal, baseCoord) => {
			const cx = w / 2;
			const cy = h / 2;
			const limit = isHorizontal ? w : h;

			ctx.beginPath();
			let first = true;
			for (let s = 0; s <= limit; s += STEP) {
				const px = isHorizontal ? s : baseCoord;
				const py = isHorizontal ? baseCoord : s;
				const dx = px - cx;
				const dy = py - cy;
				const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
				const disp = getDisp(elapsed, dist);
				const nx = dx / dist;
				const ny = dy / dist;
				const fx = px + nx * disp;
				const fy = py + ny * disp;
				if (first) {
					ctx.moveTo(fx, fy);
					first = false;
				} else {
					ctx.lineTo(fx, fy);
				}
			}
			ctx.stroke();
		};

		const animate = (t) => {
			// Normalise to elapsed time so ring phases start from a known state
			// on the very first frame, regardless of absolute performance.now().
			if (startTime === null) startTime = t;
			const elapsed = t - startTime;

			if (resolvedBg === "transparent") {
				ctx.clearRect(0, 0, w, h);
			} else {
				ctx.fillStyle = resolvedBg;
				ctx.fillRect(0, 0, w, h);
			}

			const cols = Math.ceil(w / spacing) + 2;
			const rows = Math.ceil(h / spacing) + 2;
			// Centre the grid so cells are equidistant from all edges.
			const offX = (w % spacing) / 2;
			const offY = (h % spacing) / 2;

			ctx.strokeStyle = `rgba(${pal.r},${pal.g},${pal.b},${pal.opacity})`;
			ctx.lineWidth = lineWidth;
			ctx.lineJoin = "round";

			for (let row = 0; row < rows; row++) {
				drawLine(elapsed, true, offY + row * spacing - spacing);
			}
			for (let col = 0; col < cols; col++) {
				drawLine(elapsed, false, offX + col * spacing - spacing);
			}

			animId = requestAnimationFrame(animate);
		};

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
			// Update so rings always travel to the farthest corner of the canvas.
			maxR = Math.sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2)) || 1;
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
	}, [variant, backgroundColor, spacing, lineWidth]);

	return (
		<canvas
			ref={canvasRef}
			className={`pointer-events-none absolute inset-0 ${className}`}
		/>
	);
}
