"use client";

import React, { useEffect, useState } from "react";

const BACKGROUND_ANIMATION_LOADERS = {
	"background-aurora": async () =>
		(await import("./background-aurora.js")).BackgroundAurora,
	"background-data-stream": async () =>
		(await import("./background-data-stream.js")).BackgroundDataStream,
	"background-grid": async () =>
		(await import("./background-grid.js")).BackgroundGrid,
	"background-isometric": async () =>
		(await import("./background-isometric.js")).BackgroundIsometric,
	"background-polygon": async () =>
		(await import("./background-polygon.js")).BackgroundPolygon,
	"background-stars": async () =>
		(await import("./background-stars.js")).BackgroundStars,
	"background-streaks": async () =>
		(await import("./background-streaks.js")).BackgroundStreaks,
	"background-vapor": async () =>
		(await import("./background-vapor.js")).BackgroundVapor,
	"background-waves": async () =>
		(await import("./background-waves.js")).BackgroundWaves,
};

function resolveAnimationName(name) {
	if (BACKGROUND_ANIMATION_LOADERS[name]) {
		return name;
	}

	return "background-aurora";
}

export function BackgroundAnimation({ name }) {
	const [AnimationComponent, setAnimationComponent] = useState(null);

	useEffect(() => {
		let cancelled = false;
		const loadAnimation =
			BACKGROUND_ANIMATION_LOADERS[resolveAnimationName(name)] ??
			BACKGROUND_ANIMATION_LOADERS["background-aurora"];

		loadAnimation()
			.then((Component) => {
				if (!cancelled) {
					setAnimationComponent(() => Component);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setAnimationComponent(() => null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [name]);

	if (!AnimationComponent) {
		return null;
	}

	return React.createElement(AnimationComponent);
}
