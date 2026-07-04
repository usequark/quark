"use client";

import { useEffect, useState } from "react";

export default function StreamingIndicator({ action, thinking }) {
	const [dots, setDots] = useState("");

	useEffect(() => {
		if (!thinking) return;
		const interval = setInterval(() => {
			setDots((prev) => (prev.length >= 3 ? "" : `${prev}.`));
		}, 400);
		return () => clearInterval(interval);
	}, [thinking]);

	if (action) {
		return (
			<div className="flex items-center gap-2 text-text-muted text-sm py-2">
				<svg
					aria-hidden="true"
					className="animate-spin h-4 w-4 text-primary"
					viewBox="0 0 24 24"
					fill="none"
				>
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					/>
				</svg>
				<span>{action}...</span>
			</div>
		);
	}

	if (thinking) {
		return (
			<div className="flex items-center gap-2 text-text-muted text-sm py-2">
				<div className="flex gap-1">
					<span className="inline-block w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse [animation-delay:0ms]" />
					<span className="inline-block w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse [animation-delay:150ms]" />
					<span className="inline-block w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse [animation-delay:300ms]" />
				</div>
				<span>Thinking{dots}</span>
			</div>
		);
	}

	return null;
}
