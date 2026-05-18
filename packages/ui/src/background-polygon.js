"use client";

import { useMemo } from "react";

// Linear congruential generator — produces a deterministic sequence from a
// seed so the mesh is identical on server and client (no hydration mismatch).
function makePRNG(seed) {
	let s = (seed + 1) >>> 0;
	return () => {
		s = (Math.imul(1664525, s) + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

function hexToRgb(hex) {
	const n = Number.parseInt(hex.replace("#", ""), 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Each triangle gets --qp-lo / --qp-hi CSS custom properties injected via
// inline style; the single shared keyframe reads them via var() so every
// polygon shimmers at a different opacity range without needing N keyframes.
const STYLE = `
@keyframes quark-poly-shimmer {
	0%, 100% { opacity: var(--qp-lo); }
	50%       { opacity: var(--qp-hi); }
}
`;

/**
 * BackgroundPolygon — a full-coverage low-poly triangulated mesh where every
 * facet subtly shimmers between two opacity values, creating a gem-like sheen.
 * The background colour is automatically derived from the base `color`.
 *
 * @param {string} className  — extra CSS classes
 * @param {string} color      — base hue as a 6-char hex (default: violet)
 * @param {number} cols       — horizontal grid subdivisions (default 10)
 * @param {number} rows       — vertical grid subdivisions (default 7)
 * @param {number} opacity    — overall wrapper opacity (0–1)
 */
export function BackgroundPolygon({
	className = "",
	color = "#a78bfa",
	cols = 10,
	rows = 7,
	opacity = 1,
}) {
	const { triangles, bg } = useMemo(() => {
		const rng = makePRNG(cols * 997 + rows * 31);
		const cellW = 100 / cols;
		const cellH = 100 / rows;
		const jitterScale = 0.38;

		// Build grid points. Edge points are never jittered so borders stay flush.
		const pts = [];
		for (let r = 0; r <= rows; r++) {
			for (let c = 0; c <= cols; c++) {
				const edgeX = c === 0 || c === cols;
				const edgeY = r === 0 || r === rows;
				const jx = edgeX ? 0 : (rng() - 0.5) * jitterScale * cellW;
				const jy = edgeY ? 0 : (rng() - 0.5) * jitterScale * cellH;
				pts.push({ x: c * cellW + jx, y: r * cellH + jy });
			}
		}

		const at = (r, c) => pts[r * (cols + 1) + c];
		const rgb = hexToRgb(color);

		const tris = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const tl = at(r, c);
				const tr = at(r, c + 1);
				const bl = at(r + 1, c);
				const br = at(r + 1, c + 1);

				// Two triangles per cell, each with independent brightness + shimmer.
				for (let t = 0; t < 2; t++) {
					const brightness = 0.65 + rng() * 0.5;
					// Blend 25% toward near-white to produce lighter, less-saturated facets.
					const fr = Math.min(
						255,
						Math.round(rgb.r * brightness * 0.75 + 235 * 0.25),
					);
					const fg = Math.min(
						255,
						Math.round(rgb.g * brightness * 0.75 + 235 * 0.25),
					);
					const fb = Math.min(
						255,
						Math.round(rgb.b * brightness * 0.75 + 235 * 0.25),
					);

					const lo = (0.5 + rng() * 0.28).toFixed(2);
					const hi = Math.min(1, parseFloat(lo) + 0.08 + rng() * 0.18).toFixed(
						2,
					);

					const p0 = t === 0 ? tl : tl;
					const p1 = t === 0 ? tr : bl;
					const p2 = br;

					tris.push({
						key: `${r}-${c}-${t}`,
						points: `${p0.x.toFixed(2)},${p0.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
						fill: `rgb(${fr},${fg},${fb})`,
						lo,
						hi,
						delay: (rng() * 8).toFixed(2),
						dur: (3 + rng() * 6).toFixed(2),
					});
				}
			}
		}

		// Backdrop derived from the base hue (52% brightness — lighter than before).
		const bgColor = `rgb(${Math.round(rgb.r * 0.52)},${Math.round(rgb.g * 0.52)},${Math.round(rgb.b * 0.52)})`;

		return { triangles: tris, bg: bgColor };
	}, [color, cols, rows]);

	return (
		<>
			<style>{STYLE}</style>
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
				style={{ opacity, backgroundColor: bg }}
			>
				<svg
					viewBox="0 0 100 100"
					preserveAspectRatio="xMidYMid slice"
					className="absolute inset-0 h-full w-full"
					aria-hidden="true"
				>
					{triangles.map((tri) => (
						<polygon
							key={tri.key}
							points={tri.points}
							fill={tri.fill}
							style={{
								"--qp-lo": tri.lo,
								"--qp-hi": tri.hi,
								animation: `quark-poly-shimmer ${tri.dur}s ease-in-out ${tri.delay}s infinite both`,
							}}
						/>
					))}
				</svg>
			</div>
		</>
	);
}
