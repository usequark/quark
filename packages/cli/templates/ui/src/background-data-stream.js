"use client";

import { useEffect, useRef } from "react";

const VARIANT_STYLES = {
	dark: {
		streamColor: "59, 126, 189",
		opacityRange: [0.05, 0.25],
		sizeRange: [1, 1.5],
		vignetteStops: ["rgba(255,255,255,0.02)", "rgba(0,0,0,0)"],
	},
	light: {
		streamColor: "71, 85, 105",
		opacityRange: [0.05, 0.2],
		sizeRange: [0.8, 1.2],
		vignetteStops: ["rgba(0,0,0,0)", "rgba(0,0,0,0.03)"],
	},
};

/**
 * BackgroundDataStream — canvas-based vertical particle streams that flow up
 * or down the container, resembling data falling through the screen.
 *
 * Defaults to a transparent background so the parent's own color shows through.
 * Set `backgroundColor` explicitly to fill the canvas with a solid color.
 *
 * @param {string}         className        — extra CSS classes
 * @param {"dark"|"light"} variant          — stream colour palette
 * @param {string}         backgroundColor  — canvas fill ("transparent" or CSS colour)
 * @param {number}         particleCount    — number of stream particles (default 40)
 * @param {"up"|"down"}    direction        — flow direction (default "up")
 */
export function BackgroundDataStream({
	className = "",
	variant = "dark",
	backgroundColor,
	particleCount = 40,
	direction = "up",
}) {
	const canvasRef = useRef(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;

		const ctx = canvas.getContext("2d");
		if (!ctx) return undefined;

		const style = VARIANT_STYLES[variant] ?? VARIANT_STYLES.dark;
		const resolvedBg = backgroundColor ?? "transparent";

		let animationFrameId;
		let particles = [];
		let resizeObserver;

		class StreamParticle {
			constructor(width, height, options = {}) {
				this.canvasWidth = width;
				this.canvasHeight = height;
				this.reset(options);
			}

			reset(options = {}) {
				const { startInView = false } = options;
				this.x = Math.random() * this.canvasWidth;
				this.speed = 0.4 + Math.random() * 0.8;
				this.opacity =
					style.opacityRange[0] +
					Math.random() * (style.opacityRange[1] - style.opacityRange[0]);
				this.size =
					style.sizeRange[0] +
					Math.random() * (style.sizeRange[1] - style.sizeRange[0]);
				this.length = 60 + Math.random() * 120;

				if (startInView) {
					// Distribute across the full canvas height on first init
					this.y =
						Math.random() * (this.canvasHeight + this.length) - this.length;
				} else if (direction === "down") {
					// Enter from above the canvas
					this.y = -this.length - Math.random() * 200;
				} else {
					// Enter from below the canvas
					this.y = this.canvasHeight + Math.random() * 200;
				}
			}

			update() {
				if (direction === "down") {
					this.y += this.speed;
					// Reset once the entire trail (head + length) has exited the bottom
					if (this.y - this.length > this.canvasHeight) {
						this.reset();
					}
				} else {
					this.y -= this.speed;
					// Reset once the entire trail (head + length) has exited the top
					if (this.y < -this.length) {
						this.reset();
					}
				}
			}

			draw(context) {
				// this.y is always the leading edge (head), tail is the opposite direction
				const tailY =
					direction === "down" ? this.y - this.length : this.y + this.length;

				// Gradient: head (opaque) → tail (transparent)
				const gradient = context.createLinearGradient(
					this.x,
					this.y,
					this.x,
					tailY,
				);
				gradient.addColorStop(0, `rgba(${style.streamColor}, ${this.opacity})`);
				gradient.addColorStop(1, `rgba(${style.streamColor}, 0)`);

				context.beginPath();
				context.strokeStyle = gradient;
				context.lineWidth = this.size;
				context.lineCap = "round";
				context.moveTo(this.x, this.y);
				context.lineTo(this.x, tailY);
				context.stroke();
			}
		}

		const init = (width, height, options = {}) => {
			particles = [];
			for (let i = 0; i < particleCount; i += 1) {
				particles.push(new StreamParticle(width, height, options));
			}
		};

		const resize = () => {
			const container = canvas.parentElement ?? canvas;
			const width = container.clientWidth || window.innerWidth;
			const height = container.clientHeight || window.innerHeight;
			const dpr = Math.max(1, window.devicePixelRatio || 1);

			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;

			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(dpr, dpr);

			init(width, height, { startInView: true });
		};

		const animate = () => {
			if (resolvedBg === "transparent") {
				ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
			} else {
				ctx.fillStyle = resolvedBg;
				ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
			}

			// Subtle radial vignette
			const centerX = canvas.clientWidth / 2;
			const centerY = canvas.clientHeight / 2;
			const radial = ctx.createRadialGradient(
				centerX,
				centerY,
				0,
				centerX,
				centerY,
				canvas.clientWidth,
			);
			radial.addColorStop(0, style.vignetteStops[0]);
			radial.addColorStop(1, style.vignetteStops[1]);
			ctx.fillStyle = radial;
			ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

			for (const particle of particles) {
				particle.update();
				particle.draw(ctx);
			}

			animationFrameId = requestAnimationFrame(animate);
		};

		window.addEventListener("resize", resize);
		if (canvas.parentElement) {
			resizeObserver = new ResizeObserver(resize);
			resizeObserver.observe(canvas.parentElement);
		}

		resize();
		animate();

		return () => {
			window.removeEventListener("resize", resize);
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			cancelAnimationFrame(animationFrameId);
		};
	}, [variant, particleCount, backgroundColor, direction]);

	return (
		<canvas
			ref={canvasRef}
			className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
			style={{ display: "block" }}
		/>
	);
}
