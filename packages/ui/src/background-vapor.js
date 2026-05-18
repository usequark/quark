"use client";

import { useId, useMemo } from "react";

const STROKE = "#0284c7";
const GRID_COLOR = "rgba(15, 23, 42, 0.05)";
const STROKE_WIDTH = 4;

// Eight distinct pipe-network layouts. Each array of path strings describes a
// set of rectilinear routes within a 1600×1600 coordinate space.
const PATHS_DATA = {
	A: [
		"M 0 200 L 300 200 L 300 600 L 900 600 L 900 200 L 1600 200",
		"M 0 600 L 300 600 L 900 600 L 1600 600",
		"M 0 1000 L 400 1000 L 400 1400 L 1000 1400 L 1000 1000 L 1600 1000",
		"M 0 1400 L 400 1400 L 1000 1400 L 1600 1400",
		"M 200 0 L 200 800 L 1200 800 L 1200 1200 L 200 1200 L 200 1600",
		"M 600 0 L 600 400 L 1400 400 L 1400 800 L 600 800 L 600 1600",
		"M 1000 0 L 1000 200 L 1600 200",
		"M 1400 0 L 1400 400 L 600 400 L 600 0",
		"M 1000 1600 L 1000 1400 L 1600 1400",
		"M 1400 1600 L 1400 800 L 1200 800 L 1200 1200 L 1400 1200 L 1400 1600",
	],
	B: [
		"M 0 200 L 600 200 L 600 800 L 1000 800 L 1000 200 L 1600 200",
		"M 0 600 L 200 600 L 200 400 L 800 400 L 800 600 L 1600 600",
		"M 0 1000 L 300 1000 L 300 1400 L 900 1400 L 900 1000 L 1600 1000",
		"M 0 1400 L 300 1400 L 900 1400 L 1600 1400",
		"M 200 0 L 200 400 L 200 600 L 200 1600",
		"M 600 0 L 600 200 L 600 800 L 600 1600",
		"M 1000 0 L 1000 200 L 1000 800 L 1100 800 L 1100 1200 L 1400 1200 L 1400 1000 L 1600 1000",
		"M 1400 0 L 1400 200 L 1600 200",
		"M 1000 1600 L 1000 1400 L 1600 1400",
		"M 1400 1600 L 1400 1200 L 1100 1200 L 1100 800 L 1400 800 L 1400 0",
	],
	C: [
		"M 0 200 L 400 200 L 400 600 L 800 600 L 800 200 L 1600 200",
		"M 0 600 L 200 600 L 200 1000 L 600 1000 L 600 600 L 1600 600",
		"M 0 1000 L 200 1000 L 600 1000 L 1400 1000 L 1600 1000",
		"M 0 1400 L 600 1400 L 600 1200 L 1000 1200 L 1000 1400 L 1600 1400",
		"M 200 0 L 200 200 L 400 200 L 400 600 L 200 600 L 0 600",
		"M 600 0 L 600 600 L 800 600 L 1000 600 L 1000 0",
		"M 1000 0 L 1000 400 L 1400 400 L 1400 1000 L 1000 1000 L 1000 1600",
		"M 1400 0 L 1400 400 L 1000 400 L 1000 0",
		"M 200 1600 L 200 1000 L 0 1000",
		"M 600 1600 L 600 1400 L 1000 1400 L 1000 1600",
		"M 1400 1600 L 1400 1000 L 1600 1000",
	],
	D: [
		"M 0 200 L 200 200 L 200 1400 L 1400 1400 L 1400 200 L 1600 200",
		"M 0 1400 L 200 1400 L 1400 1400 L 1600 1400",
		"M 0 600 L 500 600 L 500 1000 L 1100 1000 L 1100 600 L 1600 600",
		"M 0 1000 L 500 1000 L 1100 1000 L 1600 1000",
		"M 200 0 L 200 200 L 1400 200 L 1400 0",
		"M 600 0 L 600 400 L 1000 400 L 1000 0",
		"M 1000 0 L 1000 400 L 600 400 L 600 0",
		"M 1400 0 L 1400 200 L 200 200 L 200 0",
		"M 200 1600 L 200 1400 L 1400 1400 L 1400 1600",
		"M 600 1600 L 600 1200 L 1000 1200 L 1000 1600",
		"M 1000 1600 L 1000 1200 L 600 1200 L 600 1600",
		"M 1400 1600 L 1400 1400 L 200 1400 L 200 1600",
	],
	E: [
		"M 0 200 L 300 200 L 300 600 L 700 600 L 700 200 L 1600 200",
		"M 0 600 L 1100 600 L 1400 600 L 1600 600",
		"M 0 1000 L 400 1000 L 400 1400 L 900 1400 L 900 1000 L 1100 1000 L 1400 1000 L 1600 1000",
		"M 0 1400 L 400 1400 L 900 1400 L 1600 1400",
		"M 200 0 L 200 800 L 600 800 L 600 1000 L 200 1000 L 200 1600",
		"M 600 0 L 600 200 L 300 200 L 300 600 L 600 600 L 600 800 L 200 800 L 200 0",
		"M 1000 0 L 1000 200 L 700 200 L 700 600 L 1100 600 L 1100 1000 L 1000 1000 L 1000 1600",
		"M 1400 0 L 1400 600 L 1100 600 L 1100 1000 L 1400 1000 L 1400 1600",
		"M 600 1600 L 600 1400 L 900 1400 L 900 1000 L 1100 1000 L 1600 1000",
	],
	F: [
		"M 0 200 L 200 200 L 200 600 L 800 600 L 800 200 L 1000 200 L 1000 600 L 1400 600 L 1400 200 L 1600 200",
		"M 0 600 L 200 600 L 800 600 L 1000 600 L 1400 600 L 1600 600",
		"M 0 1000 L 300 1000 L 300 1400 L 800 1400 L 800 1000 L 1000 1000 L 1400 1000 L 1600 1000",
		"M 0 1400 L 300 1400 L 800 1400 L 1000 1400 L 1400 1400 L 1600 1400",
		"M 200 0 L 200 200 L 0 200",
		"M 600 0 L 600 200 L 800 200 L 800 600 L 600 600 L 600 1600",
		"M 1000 0 L 1000 200 L 1400 200 L 1400 600 L 1000 600 L 1000 1600",
		"M 1400 0 L 1400 200 L 1000 200 L 1000 0",
		"M 200 1600 L 200 1400 L 300 1400 L 300 1000 L 200 1000 L 200 1600",
		"M 600 1600 L 600 600 L 800 600 L 800 1400 L 600 1400 L 600 1600",
		"M 1000 1600 L 1000 1400 L 800 1400 L 800 1000 L 1000 1000 L 1000 1600",
		"M 1400 1600 L 1400 1400 L 1000 1400 L 1000 1600",
	],
	G: [
		"M 0 200 L 400 200 L 400 600 L 800 600 L 800 200 L 1100 200 L 1100 600 L 1400 600 L 1400 200 L 1600 200",
		"M 0 600 L 400 600 L 800 600 L 1100 600 L 1400 600 L 1600 600",
		"M 0 1000 L 300 1000 L 300 1400 L 700 1400 L 700 1000 L 1000 1000 L 1400 1000 L 1600 1000",
		"M 0 1400 L 300 1400 L 700 1400 L 1000 1400 L 1400 1400 L 1600 1400",
		"M 200 0 L 200 200 L 400 200 L 400 600 L 200 600 L 200 1600",
		"M 600 0 L 600 200 L 800 200 L 800 600 L 600 600 L 600 1600",
		"M 1000 0 L 1000 200 L 1100 200 L 1100 600 L 1000 600 L 1000 1000 L 1000 1400 L 1000 1600",
		"M 1400 0 L 1400 200 L 1100 200 L 1100 600 L 1400 600 L 1400 1000 L 1400 1400 L 1400 1600",
		"M 200 1600 L 200 1400 L 300 1400 L 300 1000 L 200 1000 L 200 1600",
		"M 600 1600 L 600 1400 L 700 1400 L 700 1000 L 600 1000 L 600 1600",
	],
	H: [
		"M 0 600 L 300 600 L 300 300 L 600 300 L 600 600 L 800 600 L 800 1000 L 600 1000 L 600 1300 L 300 1300 L 300 1000 L 0 1000",
		"M 1600 600 L 1300 600 L 1300 300 L 1000 300 L 1000 600 L 800 600 L 800 1000 L 1000 1000 L 1000 1300 L 1300 1300 L 1300 1000 L 1600 1000",
		"M 0 200 L 300 200 L 300 300 L 600 300 L 600 200 L 1600 200",
		"M 0 1400 L 300 1400 L 300 1300 L 600 1300 L 600 1400 L 1600 1400",
		"M 200 0 L 200 200 L 300 200 L 300 300 L 200 300 L 200 1600",
		"M 600 0 L 600 200 L 1000 200 L 1000 300 L 1300 300 L 1300 200 L 1400 200 L 1400 0",
		"M 600 1600 L 600 1400 L 300 1400 L 300 1300 L 600 1300 L 600 1600",
		"M 1000 0 L 1000 200 L 1000 300 L 1000 600 L 1000 1000 L 1000 1300 L 1000 1400 L 1000 1600",
		"M 1400 0 L 1400 200 L 1300 200 L 1300 300 L 1400 300 L 1400 1600",
		"M 200 1600 L 200 1300 L 300 1300 L 300 1400 L 200 1400 L 200 1600",
		"M 1000 1600 L 1000 1400 L 1300 1400 L 1300 1300 L 1000 1300 L 1000 1600",
		"M 1400 1600 L 1400 1400 L 1300 1400 L 1300 1300 L 1400 1300 L 1400 1600",
	],
};

const VARIANTS = [
	PATHS_DATA.A,
	PATHS_DATA.B,
	PATHS_DATA.C,
	PATHS_DATA.D,
	PATHS_DATA.E,
	PATHS_DATA.F,
	PATHS_DATA.G,
	PATHS_DATA.H,
];

// CSS-only path-draw and node-appear keyframes (no framer-motion dependency).
const STYLE = `
@keyframes quark-vapor-draw {
	from {
		stroke-dashoffset: 10000;
		opacity: 0;
	}
	to {
		stroke-dashoffset: 0;
		opacity: 1;
	}
}
@keyframes quark-vapor-node {
	from {
		opacity: 0;
		transform: scale(0);
	}
	to {
		opacity: 1;
		transform: scale(1);
	}
}
`;

// Manhattan distance along a rectilinear path — used to scale animation duration.
function getPathLength(pathStr) {
	const coords = pathStr.match(/[ML]\s+(\d+)\s+(\d+)/g) ?? [];
	let len = 0;
	let px = null;
	let py = null;
	for (const coord of coords) {
		const match = coord.match(/[ML]\s+(\d+)\s+(\d+)/);
		if (!match) continue;
		const x = Number.parseInt(match[1], 10);
		const y = Number.parseInt(match[2], 10);
		if (px !== null && py !== null) {
			len += Math.abs(x - px) + Math.abs(y - py);
		}
		px = x;
		py = y;
	}
	return len;
}

function VaporNode({ x, y, delay }) {
	return (
		<rect
			x={x - 6}
			y={y - 6}
			width="12"
			height="12"
			style={{
				opacity: 0,
				transformBox: "fill-box",
				transformOrigin: "center center",
				animation: `quark-vapor-node 0.5s ease-out ${delay}s both`,
			}}
		/>
	);
}

function PipeNetworkRenderer({ variantData, ox = 0, oy = 0 }) {
	const { paths, nodes } = useMemo(() => {
		const parsedPaths = [];
		const nodesMap = new Map();

		for (const [pIdx, pathStr] of variantData.entries()) {
			const len = getPathLength(pathStr);
			// Scale duration 2.5–4.5 s proportional to path length (max ~3200 units)
			const lengthFactor = Math.min(Math.max(len / 3200, 0), 1);
			const duration = 2.5 + lengthFactor * 2.0;
			const baseDelay = pIdx * 0.04;

			parsedPaths.push({
				id: `vp-${ox}-${oy}-${pIdx}`,
				d: pathStr,
				duration,
				delay: baseDelay,
			});

			const coords = pathStr.match(/[ML]\s+(\d+)\s+(\d+)/g) ?? [];
			for (const [i, coord] of coords.entries()) {
				const match = coord.match(/[ML]\s+(\d+)\s+(\d+)/);
				if (!match) continue;
				const x = Number.parseInt(match[1], 10);
				const y = Number.parseInt(match[2], 10);
				if (x > 0 && x < 1600 && y > 0 && y < 1600) {
					const key = `${x},${y}`;
					if (!nodesMap.has(key)) {
						nodesMap.set(key, { x, y, delay: baseDelay + i * 0.02 });
					}
				}
			}
		}

		return { paths: parsedPaths, nodes: Array.from(nodesMap.values()) };
	}, [variantData, ox, oy]);

	return (
		<g transform={`translate(${ox},${oy})`}>
			<g fill={STROKE}>
				{nodes.map((node) => (
					<VaporNode
						key={`${node.x}-${node.y}`}
						x={node.x}
						y={node.y}
						delay={node.delay}
					/>
				))}
			</g>
			<g
				fill="none"
				stroke={STROKE}
				strokeWidth={STROKE_WIDTH}
				strokeLinecap="butt"
			>
				{paths.map((path) => (
					<path
						key={path.id}
						d={path.d}
						style={{
							strokeDasharray: 10000,
							strokeDashoffset: 10000,
							animation: `quark-vapor-draw ${path.duration}s cubic-bezier(0.4,0,0.2,1) ${0.2 + path.delay}s both`,
						}}
					/>
				))}
			</g>
		</g>
	);
}

function hashVariant(str) {
	let h = 0;
	for (let i = 0; i < str.length; i++) {
		h = (h * 31 + str.charCodeAt(i)) >>> 0;
	}
	return h % VARIANTS.length;
}

/**
 * BackgroundVapor — animated rectilinear pipe network rendered on an isometric
 * CSS 3D grid. Paths draw themselves in on mount; a radial mask fades the edges.
 *
 * Eight different circuit layouts (variants 0–7) or a deterministic string seed.
 *
 * @param {string} className — extra CSS classes
 * @param {number} variant   — 0–7 selects a layout directly
 * @param {string} seed      — string hashed to pick a layout (ignored when variant is set)
 */
export function BackgroundVapor({ variant, seed, className = "" }) {
	const uid = useId();
	// Replace colons (React useId format) so the string is a valid XML ID
	const patternId = `qvg${uid.replace(/:/g, "")}`;

	const idx =
		typeof variant === "number"
			? variant % VARIANTS.length
			: typeof seed === "string"
				? hashVariant(seed)
				: 0;

	const variantData = VARIANTS[idx];

	return (
		<>
			<style>{STYLE}</style>
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
				style={{
					maskImage:
						"radial-gradient(ellipse at center, black 0%, black 45%, transparent 80%)",
					WebkitMaskImage:
						"radial-gradient(ellipse at center, black 0%, black 45%, transparent 80%)",
				}}
			>
				<div
					className="absolute pointer-events-none"
					style={{
						width: "200vmax",
						height: "200vmax",
						top: "50%",
						left: "50%",
						transformStyle: "preserve-3d",
						transform: "translate(-50%, -50%) rotateX(60deg) rotateZ(-45deg)",
					}}
				>
					{/* Isometric grid background */}
					<svg
						className="absolute inset-0 h-full w-full"
						overflow="visible"
						style={{ transform: "translateZ(-10px)" }}
						aria-hidden="true"
					>
						<defs>
							<pattern
								id={patternId}
								width="40"
								height="40"
								patternUnits="userSpaceOnUse"
							>
								<path
									d="M 40 0 L 0 0 0 40"
									fill="none"
									stroke={GRID_COLOR}
									strokeWidth="1"
								/>
							</pattern>
						</defs>
						<rect
							x="-50%"
							y="-50%"
							width="200%"
							height="200%"
							fill={`url(#${patternId})`}
						/>
					</svg>

					{/* Pipe network — 2×2 tiled for seamless coverage */}
					<svg
						viewBox="0 0 3200 3200"
						preserveAspectRatio="xMidYMid slice"
						className="absolute inset-0 h-full w-full opacity-60"
						overflow="visible"
						aria-hidden="true"
					>
						<PipeNetworkRenderer variantData={variantData} ox={0} oy={0} />
						<PipeNetworkRenderer variantData={variantData} ox={1600} oy={0} />
						<PipeNetworkRenderer variantData={variantData} ox={0} oy={1600} />
						<PipeNetworkRenderer
							variantData={variantData}
							ox={1600}
							oy={1600}
						/>
					</svg>
				</div>
			</div>
		</>
	);
}
