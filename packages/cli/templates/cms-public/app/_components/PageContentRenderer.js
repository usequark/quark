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
					block.eyebrow ||
						block.title ||
						hasRenderableTextValue(block.subtitle),
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
	standard: "max-w-5xl",
	narrow: "max-w-3xl",
	immersive: "max-w-6xl",
};

const ALTERNATING_BACKGROUNDS = ["bg-surface", "bg-bg"];

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
		<article className="bg-bg text-text">
			<div
				className={`mx-auto w-full ${layoutClass} px-5 py-8 sm:px-8 sm:py-12`}
			>
				{showHeader && (title || excerpt) && (
					<header className="border-b border-border pb-6">
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
						/>
					))}
				</div>
			</div>
		</article>
	);
}

function PageBlock({ block, previewMode, sectionBg = "" }) {
	switch (block?.type) {
		case "hero":
			if (!block.eyebrow && !block.title && !block.subtitle) return null;
			return (
				<div className={`${sectionBg}`.trim()}>
					<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-14">
						<div className="max-w-3xl">
							{block.eyebrow && (
								<p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
									{block.eyebrow}
								</p>
							)}
							<h2
								className={`${block.eyebrow ? "mt-2 " : ""}text-2xl font-semibold tracking-tight text-text sm:text-3xl`}
							>
								{block.title}
							</h2>
							{renderRichContent(
								block.subtitle,
								"mt-3 text-sm text-text-muted sm:text-base",
							)}
						</div>
					</div>
				</div>
			);
		case "default":
			if (!block.eyebrow && !block.title && !block.body) return null;
			return (
				<div className={`${sectionBg}`.trim()}>
					<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
						<div className="max-w-3xl">
							{block.eyebrow && (
								<p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
									{block.eyebrow}
								</p>
							)}
							<h3 className="mt-2 text-2xl font-semibold tracking-tight text-text">
								{block.title}
							</h3>
							{renderRichContent(
								block.body,
								"mt-4 text-sm leading-7 text-text-muted",
							)}
						</div>
					</div>
				</div>
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
				<div className={`${sectionBg}`.trim()}>
					<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
						<div className="max-w-3xl">
							{block.eyebrow && (
								<p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
									{block.eyebrow}
								</p>
							)}
							<h3 className="mt-2 text-2xl font-semibold tracking-tight text-text">
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
				</div>
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
			return (
				<div className={`${sectionBg}`.trim()}>
					<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-14">
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
				</div>
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
					width={800}
					height={600}
					className="h-full min-h-56 w-full object-cover"
				/>
			</figure>
		);
	}

	return (
		<div className="min-w-0">
			{renderRichContent(
				body || `Add ${fallbackLabel} column text.`,
				"text-sm leading-7 text-text-muted",
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
			className,
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
