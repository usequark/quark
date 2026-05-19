import React from "react";
import { Button } from "./button.js";

const shellCls =
	"relative overflow-hidden rounded-[--radius-default] border border-border bg-surface";
const containerCls = "relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const BACKGROUND_TONES = {
	surface: "bg-surface",
	muted: "bg-surface-hover/70",
	primary: "bg-primary/15",
	info: "bg-info-muted/35",
	success: "bg-success-muted/30",
	warning: "bg-warning-muted/30",
};

const EmptyBackgroundAnimation = () => null;

const BACKGROUND_ANIMATIONS = {
	"background-aurora": EmptyBackgroundAnimation,
	"background-data-stream": EmptyBackgroundAnimation,
	"background-grid": EmptyBackgroundAnimation,
	"background-isometric": EmptyBackgroundAnimation,
	"background-polygon": EmptyBackgroundAnimation,
	"background-stars": EmptyBackgroundAnimation,
	"background-streaks": EmptyBackgroundAnimation,
	"background-vapor": EmptyBackgroundAnimation,
	"background-waves": EmptyBackgroundAnimation,
};

export const SECTION_VARIANTS = ["hero", "default", "split", "cta"];

export function Section({ type = "default", ...props }) {
	switch (type) {
		case "hero":
			return SectionHero(props);
		case "split":
			return SectionSplit(props);
		case "cta":
			return SectionCta(props);
		default:
			return SectionDefault(props);
	}
}

export function SectionHero({
	className = "",
	eyebrow = "",
	title = "Hero title",
	subtitle = "A slim, focused header area with supporting subheader copy.",
	backgroundMode = "image",
	backgroundValue = "",
	backgroundTone = "primary",
	backgroundContent = null,
}) {
	const backgroundLayer = createBackgroundLayer({
		backgroundMode,
		backgroundValue,
		backgroundTone,
		backgroundContent,
		showOverlay: true,
	});

	return React.createElement(
		"section",
		{ className: `${shellCls} min-h-[13rem] ${className}`.trim() },
		backgroundLayer,
		React.createElement(
			"div",
			{ className: `${containerCls} py-12 sm:py-14` },
			React.createElement(
				"div",
				{ className: "max-w-3xl" },
				eyebrow
					? React.createElement(
							"p",
							{
								className:
									"font-mono text-[11px] uppercase tracking-[0.2em] text-white/80",
							},
							eyebrow,
						)
					: null,
				React.createElement(
					"h2",
					{
						className: `${eyebrow ? "mt-2 " : ""}text-2xl font-semibold tracking-tight text-white sm:text-3xl`,
					},
					title,
				),
				...createContentNodes(
					subtitle,
					"mt-3 text-sm text-white/85 sm:text-base",
				),
			),
		),
	);
}

export function SectionDefault({
	className = "",
	eyebrow = "Overview",
	title = "Default page section",
	body = "Use this section for standard page copy with a tight eyebrow + heading pair and body text below.",
}) {
	return React.createElement(
		"section",
		{ className: `${shellCls} ${className}`.trim() },
		React.createElement(
			"div",
			{ className: `${containerCls} py-10 sm:py-12` },
			React.createElement(
				"div",
				{ className: "max-w-3xl" },
				eyebrow
					? React.createElement(
							"p",
							{
								className:
									"font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint",
							},
							eyebrow,
						)
					: null,
				React.createElement(
					"h3",
					{ className: "mt-2 text-2xl font-semibold tracking-tight text-text" },
					title,
				),
				...createContentNodes(body, "mt-4 text-sm leading-7 text-text-muted"),
			),
		),
	);
}

export function SectionSplit({
	className = "",
	eyebrow = "Details",
	title = "Split page section",
	leftKind = "text",
	leftBody = "Left column content. Use this for richer explanatory text.",
	leftSrc = "",
	leftAlt = "",
	rightKind = "image",
	rightBody = "Right column content. On smaller viewports this stacks below the left column.",
	rightSrc = "",
	rightAlt = "",
}) {
	return React.createElement(
		"section",
		{ className: `${shellCls} ${className}`.trim() },
		React.createElement(
			"div",
			{ className: `${containerCls} py-10 sm:py-12` },
			React.createElement(
				"div",
				{ className: "max-w-3xl" },
				eyebrow
					? React.createElement(
							"p",
							{
								className:
									"font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint",
							},
							eyebrow,
						)
					: null,
				React.createElement(
					"h3",
					{ className: "mt-2 text-2xl font-semibold tracking-tight text-text" },
					title,
				),
			),
			React.createElement(
				"div",
				{ className: "mt-6 grid gap-4 md:grid-cols-2" },
				createSplitColumn({
					kind: leftKind,
					body: leftBody,
					src: leftSrc,
					alt: leftAlt,
					fallbackLabel: "left",
				}),
				createSplitColumn({
					kind: rightKind,
					body: rightBody,
					src: rightSrc,
					alt: rightAlt,
					fallbackLabel: "right",
				}),
			),
		),
	);
}

export function SectionCta({
	className = "",
	title = "Ready to move forward?",
	subtitle = "Use CTA sections at the end of the page to direct users to the next action.",
	primaryAction = { label: "Get Started", href: "#" },
	secondaryAction = { label: "Contact Sales", href: "#" },
	backgroundMode = "color",
	backgroundValue = "primary",
	backgroundTone = "primary",
	backgroundContent = null,
}) {
	const backgroundLayer = createBackgroundLayer({
		backgroundMode,
		backgroundValue,
		backgroundTone,
		backgroundContent,
		showOverlay: false,
	});

	return React.createElement(
		"section",
		{ className: `${shellCls} ${className}`.trim() },
		backgroundLayer,
		React.createElement(
			"div",
			{ className: `${containerCls} py-12 sm:py-14` },
			React.createElement(
				"div",
				{ className: "mx-auto max-w-3xl text-center" },
				React.createElement(
					"h3",
					{
						className:
							"text-2xl font-semibold tracking-tight text-text sm:text-3xl",
					},
					title,
				),
				...createContentNodes(
					subtitle,
					"mt-3 text-sm text-text-muted sm:text-base",
				),
				React.createElement(
					"div",
					{
						className: "mt-6 flex flex-wrap items-center justify-center gap-3",
					},
					renderAction(primaryAction, "primary"),
					renderAction(secondaryAction, "secondary"),
				),
			),
		),
	);
}

function createSplitColumn({ kind, body, src, alt, fallbackLabel }) {
	if (kind === "image" && src) {
		return React.createElement(
			"figure",
			{
				className:
					"overflow-hidden rounded-[--radius-default] border border-border bg-bg",
			},
			React.createElement("img", {
				src,
				alt: alt || `${fallbackLabel} media`,
				className: "h-full min-h-56 w-full object-cover",
			}),
		);
	}

	return React.createElement(
		"div",
		{
			className: "min-w-0",
		},
		...createContentNodes(
			body || `Add ${fallbackLabel} column text.`,
			"text-sm leading-7 text-text-muted",
		),
	);
}

function createBackgroundLayer({
	backgroundMode,
	backgroundValue,
	backgroundTone,
	backgroundContent,
	showOverlay,
}) {
	if (backgroundContent) {
		return React.createElement(
			"div",
			{ className: "absolute inset-0" },
			backgroundContent,
			showOverlay
				? React.createElement("div", {
						className: "absolute inset-0 bg-black/45",
					})
				: null,
		);
	}

	if (backgroundMode === "image" && backgroundValue) {
		return React.createElement(
			"div",
			{ className: "absolute inset-0" },
			React.createElement("img", {
				src: backgroundValue,
				alt: "",
				"aria-hidden": true,
				className: "h-full w-full object-cover",
			}),
			showOverlay
				? React.createElement("div", {
						className: "absolute inset-0 bg-black/45",
					})
				: null,
		);
	}

	if (backgroundMode === "animation") {
		const AnimationComponent = resolveAnimationComponent(backgroundValue);
		if (!AnimationComponent) {
			return React.createElement("div", {
				className: `absolute inset-0 ${getToneClass(backgroundTone)}`,
			});
		}

		return React.createElement(
			"div",
			{ className: "absolute inset-0" },
			React.createElement("div", {
				className: `absolute inset-0 ${getToneClass(backgroundTone)}`,
			}),
			React.createElement(
				"div",
				{ className: "absolute inset-0" },
				React.createElement(AnimationComponent, null),
			),
			showOverlay
				? React.createElement("div", {
						className: "absolute inset-0 bg-black/35",
					})
				: null,
		);
	}

	return React.createElement("div", {
		className: `absolute inset-0 ${getToneClass(backgroundValue || backgroundTone)}`,
	});
}

function createContentNodes(text, className) {
	const value = typeof text === "string" ? text.trim() : "";
	if (!value) {
		return [];
	}

	if (/<[a-z][\s\S]*>/i.test(value)) {
		const sanitized = sanitizeRichTextHtml(value);
		if (!sanitized) {
			return [];
		}

		return [
			React.createElement("div", {
				key: "rich-text",
				className,
				dangerouslySetInnerHTML: { __html: sanitized },
			}),
		];
	}

	return value
		.split(/\n{2,}/)
		.map((paragraph, index) =>
			React.createElement(
				"p",
				{ key: `p-${index}`, className },
				paragraph.trim(),
			),
		);
}

function sanitizeRichTextHtml(html) {
	return html
		.replace(
			/<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|select|button|link|meta)[^>]*>/gi,
			"",
		)
		.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(
			/\s(href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
			(match, _attr, value) => {
				const normalizedValue = value
					.trim()
					.replace(/^['"]|['"]$/g, "")
					.replace(/\s/g, "")
					.toLowerCase();

				return /^(javascript|vbscript|data):/.test(normalizedValue)
					? ""
					: match;
			},
		)
		.trim();
}

function renderAction(action, variant) {
	if (!action?.label || !action?.href) {
		return null;
	}

	const rel =
		action.target === "_blank"
			? (action.rel ?? "noopener noreferrer")
			: action.rel;

	return React.createElement(
		Button,
		{
			href: action.href,
			variant,
			rel,
			target: action.target,
		},
		action.label,
	);
}

function getToneClass(tone) {
	return BACKGROUND_TONES[tone] ?? BACKGROUND_TONES.surface;
}

function resolveAnimationComponent(backgroundValue) {
	const normalized = normalizeAnimationValue(backgroundValue);
	if (!normalized) {
		return BACKGROUND_ANIMATIONS["background-aurora"];
	}

	if (BACKGROUND_ANIMATIONS[normalized]) {
		return BACKGROUND_ANIMATIONS[normalized];
	}

	if (!normalized.startsWith("background-")) {
		const prefixed = `background-${normalized}`;
		return BACKGROUND_ANIMATIONS[prefixed] ?? null;
	}

	return null;
}

function normalizeAnimationValue(value) {
	if (typeof value !== "string") {
		return "";
	}

	return value
		.trim()
		.toLowerCase()
		.replaceAll("_", "-")
		.replaceAll(/\s+/g, "-");
}
