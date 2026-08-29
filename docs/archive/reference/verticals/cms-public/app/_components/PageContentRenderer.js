import {
	sanitizeRichTextHtml,
	stripHtml,
} from "@techstream/quark-cms/sanitize";
import { Button } from "@techstream/quark-ui";
import Image from "next/image";
import React from "react";
import { normalizePageContent } from "../../lib/content/page-content.js";

function hasRenderableContent(blocks) {
	return blocks.some((block) => {
		switch (block?.type) {
			case "hero":
				return Boolean(
					block.backgroundImage ||
						block.eyebrow ||
						block.title ||
						hasRenderableTextValue(block.subtitle) ||
						(block.primaryCtaLabel && block.primaryCtaHref) ||
						(block.secondaryCtaLabel && block.secondaryCtaHref),
				);
			case "default":
				return Boolean(
					block.eyebrow || block.title || hasRenderableTextValue(block.body),
				);
			case "split":
				return Boolean(
					block.eyebrow ||
						block.title ||
						hasRenderableSplitColumn(
							block.leftKind,
							block.leftBody,
							block.leftSrc,
						) ||
						hasRenderableSplitColumn(
							block.rightKind,
							block.rightBody,
							block.rightSrc,
						),
				);
			case "cta":
				return Boolean(
					block.title ||
						hasRenderableTextValue(block.subtitle) ||
						(block.primaryLabel && block.primaryHref) ||
						(block.secondaryLabel && block.secondaryHref),
				);
			default:
				return false;
		}
	});
}

function hasRenderableSplitColumn(kind, body, src) {
	if (kind === "image") {
		return Boolean(src);
	}

	return hasRenderableTextValue(body);
}

function hasRenderableTextValue(value) {
	return stripHtml(value).trim().length > 0;
}

const LAYOUT_CLASSES = {
	standard: "max-w-none px-0",
	narrow: "max-w-3xl",
	immersive: "max-w-6xl",
};

const SECTION_INNER_CLASSES = {
	standard: "max-w-[80%] mx-auto",
	narrow: "max-w-3xl mx-auto",
	immersive: "max-w-6xl mx-auto",
};

const ALTERNATING_BACKGROUNDS = ["bg-surface", "bg-bg"];

const TONE_BG_CLASSES = {
	surface: "bg-surface",
	muted: "bg-bg",
	primary: "bg-primary-muted",
	info: "bg-info-muted",
	success: "bg-success-muted",
	warning: "bg-warning-muted",
};

export function pageHasRenderableContent(content, fallbackBody = "") {
	return hasRenderableContent(normalizePageContent(content, fallbackBody));
}

export default function PageContentRenderer({
	title,
	excerpt,
	content,
	fallbackBody = "",
	layout = "standard",
	previewMode = false,
	showHeader = false,
}) {
	const blocks = normalizePageContent(content, fallbackBody);
	const hasContent = hasRenderableContent(blocks);
	const layoutClass = LAYOUT_CLASSES[layout] ?? LAYOUT_CLASSES.standard;

	if (!title && !excerpt && !hasContent) {
		return (
			<div className="rounded-[--radius-default] border border-dashed border-border px-6 py-10 text-center text-sm text-text-faint">
				Add a title and at least one section to preview the page.
			</div>
		);
	}

	return (
		<section className="bg-bg text-text">
			<div className={`mx-auto w-full ${layoutClass}`}>
				{showHeader && (title || excerpt) && (
					<header
						className={`border-b border-border pb-6 ${layout === "standard" ? "mx-auto w-full max-w-5xl px-5 sm:px-8" : ""}`}
					>
						{title && (
							<h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
								{title}
							</h1>
						)}
						{excerpt && (
							<p className="mt-3 max-w-2xl text-base leading-7 text-text-muted sm:text-lg">
								{excerpt}
							</p>
						)}
					</header>
				)}

				<div
					className={
						previewMode
							? `divide-y divide-border ${showHeader ? "pt-6 sm:pt-8" : ""}`
							: ""
					}
				>
					{blocks.map((block, index) => (
						<PageBlock
							key={block.id ?? `${block.type}-${JSON.stringify(block)}`}
							block={block}
							previewMode={previewMode}
							sectionBg={getAlternatingBg(blocks, index)}
							sectionInnerClass={
								SECTION_INNER_CLASSES[layout] ?? SECTION_INNER_CLASSES.standard
							}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

function PageBlock({
	block,
	previewMode,
	sectionBg = "",
	sectionInnerClass = "w-full",
}) {
	switch (block?.type) {
		case "hero": {
			if (
				!block.eyebrow &&
				!block.title &&
				!block.subtitle &&
				!block.backgroundImage &&
				!(block.primaryCtaLabel && block.primaryCtaHref) &&
				!(block.secondaryCtaLabel && block.secondaryCtaHref)
			)
				return null;
			const hasBgImage =
				block.backgroundMode === "image" && block.backgroundImage;
			const toneBg =
				!hasBgImage && block.backgroundMode === "color"
					? TONE_BG_CLASSES[block.backgroundValue] || sectionBg
					: sectionBg;
			return (
				<section
					className={`${hasBgImage ? "relative overflow-hidden bg-cover bg-center bg-no-repeat h-[calc(100vh-73px)] flex items-center justify-center" : ""} ${!hasBgImage ? toneBg : ""}`.trim()}
					role={hasBgImage && block.backgroundImageAlt ? "img" : undefined}
					aria-label={
						hasBgImage && block.backgroundImageAlt
							? block.backgroundImageAlt
							: undefined
					}
					style={
						hasBgImage
							? { backgroundImage: `url(${block.backgroundImage})` }
							: undefined
					}
				>
					{hasBgImage && (
						<div
							className="absolute inset-0 bg-black/50 pointer-events-none"
							aria-hidden="true"
						/>
					)}
					<div
						className={`relative z-10 w-full ${sectionInnerClass} px-4 sm:px-6 lg:px-8 py-12 sm:py-14 ${hasBgImage ? "min-h-[60vh] flex items-center justify-center" : ""}`}
					>
						<div className="mx-auto max-w-3xl text-center">
							{block.eyebrow && (
								<p
									className={`font-mono text-[12px] uppercase tracking-[0.2em] ${hasBgImage ? "text-white/70" : "text-text-faint"}`}
								>
									{block.eyebrow}
								</p>
							)}
							<h2
								className={`${block.eyebrow ? "mt-2 " : ""} text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[4rem] ${hasBgImage ? "text-white" : "text-text"}`}
							>
								{block.title}
							</h2>
							{renderRichContent(
								block.subtitle,
								`mt-3 text-sm sm:text-xl ${hasBgImage ? "text-white/80" : "text-text-muted"}`,
							)}
							{(block.primaryCtaLabel || block.secondaryCtaLabel) && (
								<div className="mt-10 flex flex-wrap items-center justify-center gap-3">
									{block.primaryCtaLabel && block.primaryCtaHref && (
										<Button
											href={previewMode ? "#" : block.primaryCtaHref}
											variant="primary"
											size="lg"
										>
											{block.primaryCtaLabel}
										</Button>
									)}
									{block.secondaryCtaLabel && block.secondaryCtaHref && (
										<Button
											href={previewMode ? "#" : block.secondaryCtaHref}
											variant="secondary"
											size="lg"
										>
											{block.secondaryCtaLabel}
										</Button>
									)}
								</div>
							)}
						</div>
					</div>
				</section>
			);
		}
		case "default":
			if (!block.eyebrow && !block.title && !block.body) return null;
			return (
				<section className={`${sectionBg}`.trim()}>
					<div
						className={`w-full ${sectionInnerClass} px-4 sm:px-6 lg:px-8 py-10 sm:py-12`}
					>
						<div className="">
							{block.eyebrow && (
								<p className="font-mono text-[12px] uppercase tracking-[0.2em] text-text-faint">
									{block.eyebrow}
								</p>
							)}
							<h3 className="mt-2 text-2xl sm:text-4xl font-semibold tracking-tight text-text">
								{block.title}
							</h3>
							{renderRichContent(
								block.body,
								"mt-4 text-sm sm:text-base leading-7 text-text-muted",
							)}
						</div>
					</div>
				</section>
			);
		case "split":
			if (
				!block.eyebrow &&
				!block.title &&
				!hasRenderableSplitColumn(
					block.leftKind,
					block.leftBody,
					block.leftSrc,
				) &&
				!hasRenderableSplitColumn(
					block.rightKind,
					block.rightBody,
					block.rightSrc,
				)
			) {
				return null;
			}
			return (
				<section className={`${sectionBg}`.trim()}>
					<div
						className={`w-full ${sectionInnerClass} px-4 sm:px-6 lg:px-8 py-10 sm:py-12`}
					>
						<div className="max-w-3xl">
							{block.eyebrow && (
								<p className="font-mono text-[12px] uppercase tracking-[0.2em] text-text-faint">
									{block.eyebrow}
								</p>
							)}
							<h3 className="mt-2 text-2xl sm:text-4xl font-semibold tracking-tight text-text">
								{block.title}
							</h3>
						</div>
						<div className="mt-6 grid gap-4 md:grid-cols-2">
							{renderSplitColumn(
								block.leftKind,
								block.leftBody,
								block.leftSrc,
								block.leftAlt,
								"left",
							)}
							{renderSplitColumn(
								block.rightKind,
								block.rightBody,
								block.rightSrc,
								block.rightAlt,
								"right",
							)}
						</div>
					</div>
				</section>
			);
		case "cta": {
			if (
				!block.title &&
				!block.subtitle &&
				!block.primaryLabel &&
				!block.secondaryLabel
			) {
				return null;
			}
			const ctaBg =
				block.backgroundMode === "color"
					? TONE_BG_CLASSES[block.backgroundValue] || sectionBg
					: sectionBg;
			return (
				<section className={`${ctaBg}`.trim()}>
					<div
						className={`w-full ${sectionInnerClass} px-4 sm:px-6 lg:px-8 py-12 sm:py-14`}
					>
						<div className="mx-auto max-w-3xl text-center">
							<h3 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
								{block.title}
							</h3>
							{renderRichContent(
								block.subtitle,
								"mt-3 text-sm text-text-muted sm:text-base",
							)}
							{(block.primaryLabel || block.secondaryLabel) && (
								<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
									{block.primaryLabel && block.primaryHref && (
										<Button
											href={previewMode ? "#" : block.primaryHref}
											variant="primary"
										>
											{block.primaryLabel}
										</Button>
									)}
									{block.secondaryLabel && block.secondaryHref && (
										<Button
											href={previewMode ? "#" : block.secondaryHref}
											variant="secondary"
										>
											{block.secondaryLabel}
										</Button>
									)}
								</div>
							)}
						</div>
					</div>
				</section>
			);
		}
		default:
			return null;
	}
}

function renderSplitColumn(kind, body, src, alt, fallbackLabel) {
	if (kind === "image" && src) {
		return (
			<figure className="overflow-hidden rounded-[--radius-default] border border-border bg-bg">
				<Image
					src={src}
					alt={alt || `${fallbackLabel} media`}
					width={600}
					height={400}
					className="min-h-20 w-full object-cover"
				/>
			</figure>
		);
	}

	return (
		<div className="min-w-0">
			{renderRichContent(
				body || `Add ${fallbackLabel} column text.`,
				"text-sm sm:text-base leading-7 text-text-muted",
			)}
		</div>
	);
}

function renderRichContent(text, className) {
	const value = typeof text === "string" ? text.trim() : "";
	if (!value) return null;

	if (/<[a-z][\s\S]*>/i.test(value)) {
		const sanitized = sanitizeRichTextHtml(value);
		if (!sanitized) return null;
		return React.createElement("div", {
			className:
				`${className} [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5`.trim(),
			dangerouslySetInnerHTML: { __html: sanitized },
		});
	}

	return value.split(/\n{2,}/).map((paragraph, index) => (
		<p
			key={paragraph.slice(0, 32).replace(/\s+/g, "-") || `p-${index}`}
			className={className}
		>
			{paragraph.trim()}
		</p>
	));
}

function getAlternatingBg(blocks, index) {
	if (!isRenderableAlternatingSection(blocks[index])) {
		return "";
	}

	let count = 0;
	for (let i = 0; i <= index; i += 1) {
		if (isRenderableAlternatingSection(blocks[i])) {
			count += 1;
		}
	}

	return ALTERNATING_BACKGROUNDS[(count - 1) % 2];
}

function isAlternatingSectionType(type) {
	return type === "default" || type === "split";
}

function isRenderableAlternatingSection(block) {
	if (!isAlternatingSectionType(block?.type)) {
		return false;
	}

	if (block.type === "default") {
		return Boolean(
			block.eyebrow || block.title || hasRenderableTextValue(block.body),
		);
	}

	return Boolean(
		block.eyebrow ||
			block.title ||
			hasRenderableSplitColumn(block.leftKind, block.leftBody, block.leftSrc) ||
			hasRenderableSplitColumn(
				block.rightKind,
				block.rightBody,
				block.rightSrc,
			),
	);
}

// stripHtml is imported from @techstream/quark-cms/sanitize
