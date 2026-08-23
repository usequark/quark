import {
	getStringValue,
	getTrimmedString,
	sanitizeRichTextHtml,
	stripHtml,
} from "../sanitize.js";
import {
	coerceJsonValue,
	createDefaultPageContent,
	createDeterministicPageBlock,
	DEFAULT_PAGE_BLOCK_IDS,
	isSafePathOrUrl,
	normalizeBackgroundToneValue,
	PAGE_BACKGROUND_TONE_VALUES,
	pageContentSchema,
} from "./schemas.js";

export function parseStoredPageContent(content) {
	const value = coerceJsonValue(content);
	if (!Array.isArray(value)) {
		return null;
	}

	const normalizedBlocks = value
		.map((block, index) => normalizeIncomingBlock(block, index))
		.filter(Boolean);

	const result = pageContentSchema.safeParse(normalizedBlocks);
	return result.success ? result.data : null;
}

export function normalizePageContent(content, fallbackBody = "") {
	const parsedContent = parseStoredPageContent(content);
	if (parsedContent && parsedContent.length > 0) {
		return parsedContent;
	}

	const legacyBody = stripHtml(
		sanitizeRichTextHtml(getStringValue(fallbackBody)),
	)
		.replace(/\s+/g, " ")
		.trim();
	if (legacyBody) {
		return [
			createDeterministicPageBlock(
				"default",
				DEFAULT_PAGE_BLOCK_IDS.legacyBody,
				{
					body: legacyBody,
				},
			),
		];
	}

	return createDefaultPageContent();
}

export function hasRenderablePageContent(content) {
	return normalizePageContent(content).some(hasRenderableBlockContent);
}

export function normalizeIncomingBlock(block, index) {
	if (!block || typeof block !== "object") {
		return null;
	}

	const id = getTrimmedString(block.id) || `page-block-${index + 1}`;
	const type = getTrimmedString(block.type);

	switch (type) {
		case "hero": {
			const backgroundMode = normalizeBackgroundMode(block.backgroundMode);
			return {
				id,
				type,
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				subtitle: sanitizeRichTextHtml(getStringValue(block.subtitle)),
				backgroundMode,
				backgroundValue: normalizeBackgroundValue(
					backgroundMode,
					block.backgroundValue,
				),
				backgroundTone: normalizeBackgroundToneValue(block.backgroundTone),
				backgroundImage:
					backgroundMode === "image"
						? sanitizePathOrUrl(block.backgroundImage)
						: "",
				backgroundImageAlt:
					backgroundMode === "image"
						? getTrimmedString(block.backgroundImageAlt)
						: "",
				primaryCtaLabel: getTrimmedString(block.primaryCtaLabel),
				primaryCtaHref: sanitizePathOrUrl(block.primaryCtaHref),
				secondaryCtaLabel: getTrimmedString(block.secondaryCtaLabel),
				secondaryCtaHref: sanitizePathOrUrl(block.secondaryCtaHref),
			};
		}
		case "default":
			return {
				id,
				type,
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				body: sanitizeRichTextHtml(getStringValue(block.body)),
			};
		case "split":
			return {
				id,
				type,
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				leftKind: normalizeSplitKind(block.leftKind),
				leftBody: sanitizeRichTextHtml(getStringValue(block.leftBody)),
				leftSrc: sanitizePathOrUrl(block.leftSrc),
				leftAlt: getTrimmedString(block.leftAlt),
				rightKind: normalizeSplitKind(block.rightKind),
				rightBody: sanitizeRichTextHtml(getStringValue(block.rightBody)),
				rightSrc: sanitizePathOrUrl(block.rightSrc),
				rightAlt: getTrimmedString(block.rightAlt),
			};
		case "cta": {
			const backgroundMode = normalizeBackgroundMode(block.backgroundMode);
			return {
				id,
				type,
				// Note: legacy CTA blocks may have had an `eyebrow` field. When both
				// `title` and `eyebrow` are present, `eyebrow` is intentionally dropped
				// here because the new `cta` schema has no eyebrow field.
				title: getTrimmedString(block.title) || getTrimmedString(block.eyebrow),
				subtitle: sanitizeRichTextHtml(
					getStringValue(block.subtitle || block.body),
				),
				primaryLabel: getTrimmedString(block.primaryLabel || block.buttonLabel),
				primaryHref: sanitizePathOrUrl(block.primaryHref || block.buttonHref),
				secondaryLabel: getTrimmedString(block.secondaryLabel),
				secondaryHref: sanitizePathOrUrl(block.secondaryHref),
				backgroundMode,
				backgroundValue: normalizeBackgroundValue(
					backgroundMode,
					block.backgroundValue,
				),
				backgroundTone: normalizeBackgroundToneValue(block.backgroundTone),
			};
		}
		case "richText":
			return {
				id,
				type: "default",
				eyebrow: "",
				title: "",
				body: sanitizeRichTextHtml(getStringValue(block.html)),
			};
		case "image":
			return {
				id,
				type: "split",
				eyebrow: "",
				title: "",
				leftKind: "image",
				leftBody: "",
				leftSrc: sanitizePathOrUrl(block.src),
				leftAlt: getTrimmedString(block.alt),
				rightKind: "text",
				rightBody: sanitizeRichTextHtml(getStringValue(block.caption)),
				rightSrc: "",
				rightAlt: "",
			};
		case "mediaText": {
			const mediaOnLeft = block.mediaPosition !== "right";
			return {
				id,
				type: "split",
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				leftKind: mediaOnLeft ? "image" : "text",
				leftBody: mediaOnLeft
					? ""
					: sanitizeRichTextHtml(getStringValue(block.body)),
				leftSrc: mediaOnLeft ? sanitizePathOrUrl(block.src) : "",
				leftAlt: mediaOnLeft ? getTrimmedString(block.alt) : "",
				rightKind: mediaOnLeft ? "text" : "image",
				rightBody: mediaOnLeft
					? sanitizeRichTextHtml(getStringValue(block.body))
					: "",
				rightSrc: mediaOnLeft ? "" : sanitizePathOrUrl(block.src),
				rightAlt: mediaOnLeft ? "" : getTrimmedString(block.alt),
			};
		}
		default:
			return null;
	}
}

export function hasRenderableBlockContent(block) {
	switch (block.type) {
		case "hero":
			return Boolean(
				block.backgroundImage ||
					block.eyebrow ||
					block.title ||
					hasRenderableRichTextContent(block.subtitle) ||
					(block.primaryCtaLabel && block.primaryCtaHref) ||
					(block.secondaryCtaLabel && block.secondaryCtaHref),
			);
		case "default":
			return Boolean(
				block.eyebrow ||
					block.title ||
					hasRenderableRichTextContent(block.body),
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
					hasRenderableRichTextContent(block.subtitle) ||
					(block.primaryLabel && block.primaryHref) ||
					(block.secondaryLabel && block.secondaryHref),
			);
		default:
			return false;
	}
}

function hasRenderableSplitColumn(kind, body, src) {
	if (kind === "image") {
		return Boolean(src);
	}

	return hasRenderableRichTextContent(body);
}

function hasRenderableRichTextContent(value) {
	return (
		stripHtml(sanitizeRichTextHtml(getStringValue(value))).trim().length > 0
	);
}

function normalizeBackgroundMode(value) {
	const normalized = getTrimmedString(value).toLowerCase();
	if (normalized === "image") return "image";
	return "color";
}

function normalizeBackgroundValue(_mode, value) {
	const normalized = getTrimmedString(value).toLowerCase();
	return PAGE_BACKGROUND_TONE_VALUES.includes(normalized)
		? normalized
		: "primary";
}

function normalizeSplitKind(value) {
	return value === "image" ? "image" : "text";
}

function sanitizePathOrUrl(value) {
	const normalized = getTrimmedString(value);
	return isSafePathOrUrl(normalized) ? normalized : "";
}
