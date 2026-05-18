"use client";

const STYLE = `
@keyframes quark-aurora-a {
	0%, 100% { transform: translate(0%, 0%) scale(1); }
	33% { transform: translate(10%, -15%) scale(1.1); }
	66% { transform: translate(-8%, 10%) scale(0.95); }
}
@keyframes quark-aurora-b {
	0%, 100% { transform: translate(0%, 0%) scale(1); }
	33% { transform: translate(-12%, 8%) scale(1.05); }
	66% { transform: translate(10%, -10%) scale(1.1); }
}
@keyframes quark-aurora-c {
	0%, 100% { transform: translate(0%, 0%) scale(1); }
	40% { transform: translate(8%, 12%) scale(0.9); }
	70% { transform: translate(-10%, -8%) scale(1.05); }
}
`;

/**
 * BackgroundAurora — three soft radial gradient blobs that drift slowly,
 * creating an aurora-borealis-style effect. Pure CSS, no canvas.
 *
 * Designed to sit behind text: keep opacity ≤ 0.3 per blob for readability.
 *
 * @param {string} className  — extra CSS classes merged onto the wrapper
 * @param {object} colors     — { a, b, c } blob fill colors (CSS color strings)
 * @param {number} opacity    — overall wrapper opacity (0–1)
 * @param {number} blur       — Gaussian blur radius in px (default 80)
 */
export function BackgroundAurora({
	className = "",
	colors = null,
	opacity = 1,
	blur = 80,
}) {
	const c = colors ?? {
		a: "rgba(56, 189, 248, 0.35)",
		b: "rgba(139, 92, 246, 0.25)",
		c: "rgba(34, 211, 238, 0.2)",
	};

	return (
		<>
			<style>{STYLE}</style>
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
				style={{ opacity }}
			>
				<div
					className="absolute"
					style={{
						width: "60%",
						height: "70%",
						top: "-10%",
						left: "-5%",
						background: `radial-gradient(ellipse at center, ${c.a} 0%, transparent 70%)`,
						filter: `blur(${blur}px)`,
						animation: "quark-aurora-a 18s ease-in-out infinite",
					}}
				/>
				<div
					className="absolute"
					style={{
						width: "55%",
						height: "65%",
						top: "15%",
						right: "-10%",
						background: `radial-gradient(ellipse at center, ${c.b} 0%, transparent 70%)`,
						filter: `blur(${blur}px)`,
						animation: "quark-aurora-b 22s ease-in-out infinite",
					}}
				/>
				<div
					className="absolute"
					style={{
						width: "50%",
						height: "60%",
						bottom: "-15%",
						left: "20%",
						background: `radial-gradient(ellipse at center, ${c.c} 0%, transparent 70%)`,
						filter: `blur(${blur}px)`,
						animation: "quark-aurora-c 26s ease-in-out infinite",
					}}
				/>
			</div>
		</>
	);
}
