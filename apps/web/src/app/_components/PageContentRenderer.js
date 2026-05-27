import { Section } from "@techstream/quark-ui";
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

const ALTERNATING_SECTION_BACKGROUNDS = ["bg-surface", "bg-bg"];

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
							sectionClassName={getAlternatingSectionClassName(blocks, index)}
						/>
					))}
				</div>
			</div>
		</article>
	);
}

function PageBlock({ block, previewMode, sectionClassName = "" }) {
	const blockClassName = joinClassNames(
		"rounded-none border-0",
		previewMode ? "" : "",
		sectionClassName,
	);

	switch (block?.type) {
		case "hero":
			if (!block.eyebrow && !block.title && !block.subtitle) return null;
			return (
				<Section
					type="hero"
					className={blockClassName}
					eyebrow={block.eyebrow}
					title={block.title}
					subtitle={block.subtitle}
					backgroundMode={block.backgroundMode}
					backgroundValue={block.backgroundValue}
					backgroundTone={block.backgroundTone}
				/>
			);
		case "default":
			if (!block.eyebrow && !block.title && !block.body) return null;
			return (
				<Section
					type="default"
					className={blockClassName}
					eyebrow={block.eyebrow}
					title={block.title}
					body={block.body}
				/>
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
				<Section
					type="split"
					className={blockClassName}
					eyebrow={block.eyebrow}
					title={block.title}
					leftKind={block.leftKind}
					leftBody={block.leftBody}
					leftSrc={block.leftSrc}
					leftAlt={block.leftAlt}
					rightKind={block.rightKind}
					rightBody={block.rightBody}
					rightSrc={block.rightSrc}
					rightAlt={block.rightAlt}
				/>
			);
		case "cta": {
			const primaryAction = toAction(
				block.primaryLabel,
				block.primaryHref,
				previewMode,
			);
			const secondaryAction = toAction(
				block.secondaryLabel,
				block.secondaryHref,
				previewMode,
			);
			if (
				!block.title &&
				!block.subtitle &&
				!primaryAction &&
				!secondaryAction
			) {
				return null;
			}

			return (
				<Section
					type="cta"
					className={blockClassName}
					title={block.title}
					subtitle={block.subtitle}
					primaryAction={primaryAction}
					secondaryAction={secondaryAction}
					backgroundMode={block.backgroundMode}
					backgroundValue={block.backgroundValue}
					backgroundTone={block.backgroundTone}
				/>
			);
		}
		default:
			return null;
	}
}

function toAction(label, href, previewMode) {
	if (!label || !href) {
		return null;
	}

	return {
		label,
		href: previewMode ? "#" : href,
	};
}

function getAlternatingSectionClassName(blocks, index) {
	if (!isRenderableAlternatingSection(blocks[index])) {
		return "";
	}

	let alternatingCount = 0;
	for (let currentIndex = 0; currentIndex <= index; currentIndex += 1) {
		if (isRenderableAlternatingSection(blocks[currentIndex])) {
			alternatingCount += 1;
		}
	}

	return ALTERNATING_SECTION_BACKGROUNDS[(alternatingCount - 1) % 2];
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

function joinClassNames(...values) {
	return values.filter(Boolean).join(" ");
}

function stripHtml(value) {
	return String(value ?? "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}
