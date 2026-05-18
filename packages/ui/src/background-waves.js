"use client";

const STYLE = `
@keyframes quark-wave {
	from { transform: translateX(0); }
	to { transform: translateX(-50%); }
}
`;

// Each path is 2 identical tile-widths (0–2400) so translating by -50%
// produces a seamless horizontal loop. Wave centres are at y 200, 300, 400
// in a 600-unit-tall viewbox — roughly the bottom two-thirds of the container.
const W_BACK =
	"M 0 200 C 200 140, 400 260, 600 200 C 800 140, 1000 260, 1200 200 C 1400 140, 1600 260, 1800 200 C 2000 140, 2200 260, 2400 200 L 2400 600 L 0 600 Z";
const W_MID =
	"M 0 300 C 200 240, 400 360, 600 300 C 800 240, 1000 360, 1200 300 C 1400 240, 1600 360, 1800 300 C 2000 240, 2200 360, 2400 300 L 2400 600 L 0 600 Z";
const W_FRONT =
	"M 0 400 C 200 340, 400 460, 600 400 C 800 340, 1000 460, 1200 400 C 1400 340, 1600 460, 1800 400 C 2000 340, 2200 460, 2400 400 L 2400 600 L 0 600 Z";

/**
 * BackgroundWaves — three layered SVG wave fills that scroll horizontally.
 *
 * Usage: place as the first child inside a `relative overflow-hidden` container.
 * The waves fill the lower portion of the container; keep parent text above the
 * mid-point, or rely on the low default opacities for readability.
 *
 * @param {string}  className — extra CSS classes
 * @param {object}  colors    — { back, mid, front } SVG fill strings
 * @param {number}  opacity   — overall opacity (0–1)
 * @param {boolean} reverse   — reverse scroll direction
 */
export function BackgroundWaves({
	className = "",
	colors = null,
	opacity = 1,
	reverse = false,
}) {
	const c = colors ?? {
		back: "rgba(56, 189, 248, 0.1)",
		mid: "rgba(14, 165, 233, 0.13)",
		front: "rgba(2, 132, 199, 0.16)",
	};
	const dir = reverse ? "reverse" : "normal";

	return (
		<>
			<style>{STYLE}</style>
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
				style={{ opacity }}
			>
				<div
					className="absolute bottom-0 left-0 h-full"
					style={{
						width: "200%",
						animation: `quark-wave 22s linear infinite ${dir}`,
					}}
				>
					<svg
						viewBox="0 0 2400 600"
						preserveAspectRatio="none"
						className="h-full w-full"
						aria-hidden="true"
					>
						<path d={W_BACK} fill={c.back} />
					</svg>
				</div>
				<div
					className="absolute bottom-0 left-0 h-full"
					style={{
						width: "200%",
						animation: `quark-wave 14s linear infinite ${dir}`,
					}}
				>
					<svg
						viewBox="0 0 2400 600"
						preserveAspectRatio="none"
						className="h-full w-full"
						aria-hidden="true"
					>
						<path d={W_MID} fill={c.mid} />
					</svg>
				</div>
				<div
					className="absolute bottom-0 left-0 h-full"
					style={{
						width: "200%",
						animation: `quark-wave 9s linear infinite ${dir}`,
					}}
				>
					<svg
						viewBox="0 0 2400 600"
						preserveAspectRatio="none"
						className="h-full w-full"
						aria-hidden="true"
					>
						<path d={W_FRONT} fill={c.front} />
					</svg>
				</div>
			</div>
		</>
	);
}
