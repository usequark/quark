"use client";

// stroke-dasharray of 10000 safely exceeds the maximum line length in any
// reasonable grid (numLines=22, gridSize=56 → max 1232 units). Animating
// dashoffset 10000→0 draws each line in from start to end.
const STYLE = `
@keyframes quark-iso-draw {
	from {
		stroke-dashoffset: 10000;
		opacity: 0;
	}
	to {
		stroke-dashoffset: 0;
		opacity: 1;
	}
}
`;

/**
 * BackgroundIsometric — an isometric CSS-transformed grid that draws itself
 * in with staggered line animations. Accent decoration, not a full-cover fill.
 *
 * The grid is positioned according to `position` (left / center / right) and
 * clipped to the parent bounds. The parent section should be `relative overflow-hidden`.
 *
 * @param {string}                     className  — extra CSS classes
 * @param {string}                     color      — stroke colour (default amber)
 * @param {number}                     numLines   — grid lines per axis (default 22)
 * @param {number}                     size       — bounding box size in px (default 1200)
 * @param {number}                     opacity    — stroke opacity (0–1, default 0.48)
 * @param {"left"|"center"|"right"}    position   — horizontal alignment (default "right")
 */
export function BackgroundIsometric({
	className = "",
	color = "#818cf8",
	numLines = 22,
	size = 1200,
	opacity = 0.48,
	position = "right",
}) {
	const gridSize = 56;
	const extent = gridSize * numLines;

	const positionCls =
		{ left: "justify-start", center: "justify-center", right: "justify-end" }[
			position
		] ?? "justify-end";

	return (
		<>
			<style>{STYLE}</style>
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-0 flex h-full w-full items-center overflow-hidden ${positionCls} ${className}`}
			>
				<div
					className="relative shrink-0"
					style={{ width: size, height: size }}
				>
					<svg
						aria-hidden="true"
						viewBox={`-20 -20 ${extent + 40} ${extent + 40}`}
						className="h-full w-full"
						style={{ transform: "skewX(-30deg) scaleY(0.86) rotate(30deg)" }}
					>
						{[...Array(numLines + 1)].map((_, i) => {
							const pos = i * gridSize;
							const lineStyle = {
								strokeDasharray: 10000,
								strokeDashoffset: 10000,
								animation: `quark-iso-draw 1.8s ease-in-out ${i * 0.03}s both`,
							};
							return (
								<g key={`iso-${pos}`}>
									<line
										x1={pos}
										y1={0}
										x2={pos}
										y2={extent}
										stroke={color}
										strokeWidth={3}
										strokeOpacity={opacity}
										style={lineStyle}
									/>
									<line
										x1={0}
										y1={pos}
										x2={extent}
										y2={pos}
										stroke={color}
										strokeWidth={3}
										strokeOpacity={opacity}
										style={lineStyle}
									/>
								</g>
							);
						})}
					</svg>
				</div>
			</div>
		</>
	);
}
