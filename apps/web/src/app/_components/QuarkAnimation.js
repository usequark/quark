"use client";

import { useEffect, useRef } from "react";

const CHARS = " .:-=+*#%@";
const W = 110;
const H = 55;

const CONF = {
	zoom: 1.16,
	speed: 1.7,
	dashLength: 16,
	dashThickness: 2.8,
	dashDistFactor: 0.36,
	ringGapMultiplier: 0.3,
	angleLimit: 0.3,
	yBounce: 1,
	ringRadius: 13,
	ringThickness: 2.6,
	yScaleFactor: 1.05,
	dashAngle: 0.8,
};

// Fixed brand palette — all three colors are part of the Quark logo identity.
const CLASS_COLORS = { s: "#2d3436", b: "#377dff", c: "#ff4757" };

export default function QuarkAnimation() {
	const ref = useRef(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		let t = 0;
		let raf;

		function render() {
			t += 0.01 * CONF.speed;

			const rY = Math.sin(t) * CONF.angleLimit;
			const yO = Math.sin(t * 1.5) * CONF.yBounce;
			const cB = new Array(W * H).fill(" ");
			const clB = new Array(W * H).fill("");
			const zB = new Float32Array(W * H).fill(-1000);

			const rR = CONF.ringRadius * CONF.zoom;
			const rT = CONF.ringThickness * CONF.zoom;
			const dL = CONF.dashLength * CONF.zoom;
			const dT = CONF.dashThickness * CONF.zoom;
			const dA = CONF.dashAngle;
			const gap = (dT / rR) * 0.8 + CONF.ringGapMultiplier;

			// Ring (torus)
			for (let p = 0; p < Math.PI * 2; p += 0.12) {
				for (let th = 0; th < Math.PI * 2; th += 0.04) {
					let d = Math.abs(th - dA);
					if (d > Math.PI) d = 2 * Math.PI - d;
					if (d < gap) continue;

					const rXx = Math.cos(th);
					const rYy = Math.sin(th);
					const x = (rR + rT * Math.cos(p)) * rXx;
					const y = (rR + rT * Math.cos(p)) * rYy * CONF.yScaleFactor;
					const z = rT * Math.sin(p);

					const rx = x * Math.cos(rY) + z * Math.sin(rY);
					const rz = -x * Math.sin(rY) + z * Math.cos(rY);
					const ry = y + yO;

					const xp = Math.floor(W / 2 + rx * 1.5);
					const yp = Math.floor(H / 2 + ry);

					if (xp >= 0 && xp < W && yp >= 0 && yp < H) {
						const i = yp * W + xp;
						if (rz > zB[i]) {
							zB[i] = rz;
							const nT = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
							const nD = ((dA % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
							clB[i] = rYy < 0 ? "s" : nT > nD ? "b" : "c";
							cB[i] =
								CHARS[
									Math.floor(
										Math.max(0, Math.min(1, (rz + rT) / (rT * 2) + 0.3)) *
											(CHARS.length - 1),
									)
								];
						}
					}
				}
			}

			// Dash (quark)
			for (let l = 0; l < dL; l += 0.6) {
				for (let p = 0; p < Math.PI * 2; p += 0.2) {
					for (let rad = 0; rad < dT; rad += 0.6) {
						const sR = rR * CONF.dashDistFactor;
						const lx = rad * Math.cos(p);
						const ly = rad * Math.sin(p);
						const lz = l;

						const tx =
							sR * Math.cos(dA) + lz * Math.cos(dA) - lx * Math.sin(dA);
						const ty =
							(sR * Math.sin(dA) + lz * Math.sin(dA) + lx * Math.cos(dA)) *
							CONF.yScaleFactor;
						const tz = ly;

						const rtx = tx * Math.cos(rY) + tz * Math.sin(rY);
						const rtz = -tx * Math.sin(rY) + tz * Math.cos(rY);
						const rty = ty + yO;

						const xp = Math.floor(W / 2 + rtx * 1.5);
						const yp = Math.floor(H / 2 + rty);

						if (xp >= 0 && xp < W && yp >= 0 && yp < H) {
							const i = yp * W + xp;
							if (rtz > zB[i]) {
								zB[i] = rtz;
								clB[i] = "c";
								cB[i] =
									CHARS[
										Math.floor(
											Math.max(0, Math.min(1, (rtz + dT) / (dT * 2) + 0.3)) *
												(CHARS.length - 1),
										)
									];
							}
						}
					}
				}
			}

			// Build HTML string — inline colors avoid global CSS pollution
			let o = "";
			for (let i = 0; i < cB.length; i++) {
				if (i > 0 && i % W === 0) o += "\n";
				const cls = clB[i];
				if (cls) {
					o += `<span style="color:${CLASS_COLORS[cls]}">${cB[i]}</span>`;
				} else {
					o += cB[i];
				}
			}

			el.innerHTML = o;
			raf = requestAnimationFrame(render);
		}

		render();
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<div
			ref={ref}
			style={{
				lineHeight: "0.82",
				letterSpacing: "0",
				whiteSpace: "pre",
				textAlign: "center",
				fontSize: "11px",
				fontWeight: "bold",
				fontFamily: "monospace",
				color: "#e0e0e0",
			}}
		/>
	);
}
