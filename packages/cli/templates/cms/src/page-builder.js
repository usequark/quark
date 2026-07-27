import { ValidationError } from "@techstream/quark-core/errors";
import { z } from "zod";
import {
	escapeAttribute,
	escapeHtml,
	getStringValue,
	getTrimmedString,
	renderRichText,
	sanitizeRichTextHtml,
	stripHtml,
} from "./sanitize.js";

export const PAGE_LAYOUTS = [
	{
		value: "standard",
		label: "Standard",
		description: "Balanced width for general content pages.",
	},
	{
		value: "narrow",
		label: "Narrow",
		description: "Reading-focused layout for editorial pages.",
	},
	{
		value: "immersive",
		label: "Immersive",
		description: "Wider canvas for media-forward landing pages.",
	},
];

export const PAGE_LAYOUT_VALUES = PAGE_LAYOUTS.map((layout) => layout.value);

export const PAGE_BACKGROUND_MODES = [
	{
		value: "color",
		label: "Color",
		description: "Use a semantic background tone.",
	},
	{
		value: "image",
		label: "Image",
		description: "Use a background image with overlay.",
	},
];

export const PAGE_BACKGROUND_MODE_VALUES = PAGE_BACKGROUND_MODES.map(
	(mode) => mode.value,
);

export const PAGE_BACKGROUND_TONES = [
	{ value: "surface", label: "Surface" },
	{ value: "muted", label: "Muted" },
	{ value: "primary", label: "Primary" },
	{ value: "info", label: "Info" },
	{ value: "success", label: "Success" },
	{ value: "warning", label: "Warning" },
];

export const PAGE_BACKGROUND_TONE_VALUES = PAGE_BACKGROUND_TONES.map(
	(tone) => tone.value,
);

export const PAGE_SPLIT_COLUMN_KINDS = [
	{ value: "text", label: "Text" },
	{ value: "image", label: "Image" },
];

export const PAGE_SPLIT_COLUMN_KIND_VALUES = PAGE_SPLIT_COLUMN_KINDS.map(
	(kind) => kind.value,
);

export const PAGE_BLOCK_TYPES = [
	{
		value: "hero",
		label: "Hero",
		description:
			"A bold section opener with title, subtitle, and hero background.",
	},
	{
		value: "default",
		label: "Default",
		description:
			"General purpose content section for heading and supporting copy.",
	},
	{
		value: "split",
		label: "Split Page",
		description: "Two-column section with text and image combinations.",
	},
	{
		value: "cta",
		label: "CTA",
		description: "Call-to-action section with primary and secondary actions.",
	},
];

const DEFAULT_PAGE_BLOCK_IDS = {
	initialDefault: "page-block-initial-default",
	legacyBody: "page-block-legacy-body",
};

const BLOCK_ID_SCHEMA = z.string().min(1).max(100);
const PAGE_LAYOUT_SCHEMA = z.enum(PAGE_LAYOUT_VALUES);

const heroBlockSchema = z
	.object({
		id: BLOCK_ID_SCHEMA,
		type: z.literal("hero"),
		eyebrow: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().max(80),
		),
		title: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().max(160),
		),
		subtitle: z.preprocess(
			(value) => sanitizeRichTextHtml(getStringValue(value)),
			z.string().max(2000),
		),
		backgroundMode: z.enum(PAGE_BACKGROUND_MODE_VALUES),
		backgroundValue: z
			.preprocess(
				(value) => normalizeBackgroundToneValue(value),
				z.enum(PAGE_BACKGROUND_TONE_VALUES),
			)
			.default("primary"),
		backgroundTone: z
			.preprocess(
				(value) => normalizeBackgroundToneValue(value),
				z.enum(PAGE_BACKGROUND_TONE_VALUES),
			)
			.default("primary"),
		backgroundImage: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().refine((value) => !value || isSafePathOrUrl(value), {
				message: "Background image must use an http(s) or root-relative URL",
			}),
		),
		backgroundImageAlt: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().max(200),
		),
		primaryCtaLabel: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().max(80),
		),
		primaryCtaHref: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().refine((value) => !value || isSafePathOrUrl(value), {
				message: "CTA links must use an http(s) or root-relative URL",
			}),
		),
		secondaryCtaLabel: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().max(80),
		),
		secondaryCtaHref: z.preprocess(
			(value) => getTrimmedString(value),
			z.string().refine((value) => !value || isSafePathOrUrl(value), {
				message: "CTA links must use an http(s) or root-relative URL",
			}),
		),
	})
	.superRefine((block, ctx) => {
		if (
			block.backgroundMode === "image" &&
			block.backgroundImage &&
			!block.backgroundImageAlt
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["backgroundImageAlt"],
				message: "Alt text is required when using a background image",
			});
		}
	});

const defaultBlockSchema = z.object({
	id: BLOCK_ID_SCHEMA,
	type: z.literal("default"),
	eyebrow: z.preprocess((value) => getTrimmedString(value), z.string().max(80)),
	title: z.preprocess((value) => getTrimmedString(value), z.string().max(160)),
	body: z.preprocess(
		(value) => sanitizeRichTextHtml(getStringValue(value)),
		z.string().max(4000),
	),
});

const splitBlockSchema = z.object({
	id: BLOCK_ID_SCHEMA,
	type: z.literal("split"),
	eyebrow: z.preprocess((value) => getTrimmedString(value), z.string().max(80)),
	title: z.preprocess((value) => getTrimmedString(value), z.string().max(160)),
	leftKind: z.enum(PAGE_SPLIT_COLUMN_KIND_VALUES),
	leftBody: z.preprocess(
		(value) => sanitizeRichTextHtml(getStringValue(value)),
		z.string().max(2000),
	),
	leftSrc: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().refine((value) => !value || isSafePathOrUrl(value), {
			message: "Split section media must use an http(s) or root-relative URL",
		}),
	),
	leftAlt: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().max(200),
	),
	rightKind: z.enum(PAGE_SPLIT_COLUMN_KIND_VALUES),
	rightBody: z.preprocess(
		(value) => sanitizeRichTextHtml(getStringValue(value)),
		z.string().max(2000),
	),
	rightSrc: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().refine((value) => !value || isSafePathOrUrl(value), {
			message: "Split section media must use an http(s) or root-relative URL",
		}),
	),
	rightAlt: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().max(200),
	),
});

const ctaBlockSchema = z.object({
	id: BLOCK_ID_SCHEMA,
	type: z.literal("cta"),
	title: z.preprocess((value) => getTrimmedString(value), z.string().max(160)),
	subtitle: z.preprocess(
		(value) => sanitizeRichTextHtml(getStringValue(value)),
		z.string().max(1000),
	),
	primaryLabel: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().max(80),
	),
	primaryHref: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().refine((value) => !value || isSafePathOrUrl(value), {
			message: "CTA links must use an http(s) or root-relative URL",
		}),
	),
	secondaryLabel: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().max(80),
	),
	secondaryHref: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().refine((value) => !value || isSafePathOrUrl(value), {
			message: "CTA links must use an http(s) or root-relative URL",
		}),
	),
	backgroundMode: z.enum(PAGE_BACKGROUND_MODE_VALUES),
	backgroundValue: z
		.preprocess(
			(value) => normalizeBackgroundToneValue(value),
			z.enum(PAGE_BACKGROUND_TONE_VALUES),
		)
		.default("primary"),
	backgroundTone: z
		.preprocess(
			(value) => normalizeBackgroundToneValue(value),
			z.enum(PAGE_BACKGROUND_TONE_VALUES),
		)
		.default("primary"),
});

export const pageBlockSchema = z.discriminatedUnion("type", [
	heroBlockSchema,
	defaultBlockSchema,
	splitBlockSchema,
	ctaBlockSchema,
]);

export const pageContentSchema = z.array(pageBlockSchema);

const pageBuilderInputSchema = z.object({
	layout: PAGE_LAYOUT_SCHEMA,
	content: pageContentSchema,
});

export function createPageBlock(type, overrides = {}) {
	const block = {
		id: createBlockId(),
		...getDefaultBlockForType(type),
		...overrides,
	};

	return pageBlockSchema.parse(block);
}

export function createDefaultPageContent() {
	return [
		createDeterministicPageBlock(
			"default",
			DEFAULT_PAGE_BLOCK_IDS.initialDefault,
		),
	];
}

export function parsePageBuilderInput(input) {
	const result = pageBuilderInputSchema.safeParse({
		layout: getTrimmedString(input?.layout) || "standard",
		content: coerceJsonValue(input?.content),
	});

	if (!result.success) {
		throw new ValidationError(result.error.issues[0].message);
	}

	return result.data;
}

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

function createDeterministicPageBlock(type, id, overrides = {}) {
	return pageBlockSchema.parse({
		id,
		...getDefaultBlockForType(type),
		...overrides,
	});
}

export function hasRenderablePageContent(content) {
	return normalizePageContent(content).some(hasRenderableBlockContent);
}

export function serializePageContentToBody(content) {
	return normalizePageContent(content)
		.map((block) => renderBlockToHtml(block))
		.filter(Boolean)
		.join("\n");
}

export function serializePageContentToPlainText(content) {
	return normalizePageContent(content)
		.map((block) => renderBlockToPlainText(block))
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

function getDefaultBlockForType(type) {
	switch (type) {
		case "hero":
			return {
				type,
				eyebrow: "",
				title: "",
				subtitle: "",
				backgroundMode: "color",
				backgroundValue: "primary",
				backgroundTone: "primary",
				backgroundImage: "",
				backgroundImageAlt: "",
				primaryCtaLabel: "",
				primaryCtaHref: "",
				secondaryCtaLabel: "",
				secondaryCtaHref: "",
			};
		case "default":
			return {
				type,
				eyebrow: "",
				title: "",
				body: "",
			};
		case "split":
			return {
				type,
				eyebrow: "",
				title: "",
				leftKind: "text",
				leftBody: "",
				leftSrc: "",
				leftAlt: "",
				rightKind: "image",
				rightBody: "",
				rightSrc: "",
				rightAlt: "",
			};
		case "cta":
			return {
				type,
				title: "",
				subtitle: "",
				primaryLabel: "",
				primaryHref: "",
				secondaryLabel: "",
				secondaryHref: "",
				backgroundMode: "color",
				backgroundValue: "primary",
				backgroundTone: "primary",
			};
		default:
			throw new ValidationError(`Unsupported page block type: ${type}`);
	}
}

function normalizeIncomingBlock(block, index) {
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

function createBlockId() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return `page-block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function coerceJsonValue(value) {
	if (typeof value !== "string") {
		return value;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return [];
	}

	try {
		return JSON.parse(trimmed);
	} catch {
		return value;
	}
}

function hasRenderableBlockContent(block) {
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

function renderBlockToHtml(block) {
	if (!hasRenderableBlockContent(block)) {
		return "";
	}

	switch (block.type) {
		case "hero": {
			const style =
				block.backgroundMode === "image" && block.backgroundImage
					? ` style="background-image:url(${escapeAttribute(block.backgroundImage)});background-size:cover;background-position:center;position:relative;"`
					: "";
			const overlay =
				block.backgroundMode === "image" && block.backgroundImage
					? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.5);pointer-events:none" aria-hidden="true"></div>'
					: "";
			const actions = [
				renderActionToHtml(block.primaryCtaLabel, block.primaryCtaHref),
				renderActionToHtml(block.secondaryCtaLabel, block.secondaryCtaHref),
			]
				.filter(Boolean)
				.join("");
			return `<section${style}><div style="position:relative;z-index:1">${overlay}${[
				block.eyebrow ? `<p>${escapeHtml(block.eyebrow)}</p>` : "",
				block.title ? `<h2>${escapeHtml(block.title)}</h2>` : "",
				renderRichText(block.subtitle),
				actions ? `<p>${actions}</p>` : "",
			]
				.filter(Boolean)
				.join("")}</div></section>`;
		}
		case "default":
			return `<section>${[
				block.eyebrow ? `<p>${escapeHtml(block.eyebrow)}</p>` : "",
				block.title ? `<h2>${escapeHtml(block.title)}</h2>` : "",
				renderRichText(block.body),
			]
				.filter(Boolean)
				.join("")}</section>`;
		case "split": {
			const left = renderSplitColumnToHtml(
				block.leftKind,
				block.leftBody,
				block.leftSrc,
				block.leftAlt,
			);
			const right = renderSplitColumnToHtml(
				block.rightKind,
				block.rightBody,
				block.rightSrc,
				block.rightAlt,
			);

			return `<section>${[
				block.eyebrow ? `<p>${escapeHtml(block.eyebrow)}</p>` : "",
				block.title ? `<h2>${escapeHtml(block.title)}</h2>` : "",
				left,
				right,
			]
				.filter(Boolean)
				.join("")}</section>`;
		}
		case "cta": {
			const actions = [
				renderActionToHtml(block.primaryLabel, block.primaryHref),
				renderActionToHtml(block.secondaryLabel, block.secondaryHref),
			]
				.filter(Boolean)
				.join("");

			return `<section>${[
				block.title ? `<h2>${escapeHtml(block.title)}</h2>` : "",
				renderRichText(block.subtitle),
				actions ? `<p>${actions}</p>` : "",
			]
				.filter(Boolean)
				.join("")}</section>`;
		}
		default:
			return "";
	}
}

function renderBlockToPlainText(block) {
	if (!hasRenderableBlockContent(block)) {
		return "";
	}

	switch (block.type) {
		case "hero":
			return [
				block.eyebrow,
				block.title,
				block.subtitle,
				block.primaryCtaLabel,
				block.secondaryCtaLabel,
			]
				.filter(Boolean)
				.join("\n")
				.trim();
		case "default":
			return [block.eyebrow, block.title, block.body]
				.filter(Boolean)
				.join("\n")
				.trim();
		case "split":
			return [
				block.eyebrow,
				block.title,
				block.leftKind === "text" ? stripHtml(block.leftBody) : block.leftAlt,
				block.rightKind === "text"
					? stripHtml(block.rightBody)
					: block.rightAlt,
			]
				.filter(Boolean)
				.join("\n")
				.trim();
		case "cta":
			return [
				block.title,
				stripHtml(block.subtitle),
				block.primaryLabel,
				block.secondaryLabel,
			]
				.filter(Boolean)
				.join("\n")
				.trim();
		default:
			return "";
	}
}

function renderSplitColumnToHtml(kind, body, src, alt) {
	if (kind === "image") {
		if (!src) return "";
		return `<figure><img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" /></figure>`;
	}

	return renderRichText(body);
}

function renderActionToHtml(label, href) {
	if (!label || !href) {
		return "";
	}

	return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
}

// renderRichText, escapeHtml, escapeAttribute, stripHtml, sanitizeRichTextHtml
// are imported from ./sanitize.js

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

function normalizeBackgroundToneValue(value) {
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

function isSafePathOrUrl(value) {
	if (!value) {
		return true;
	}

	if (value.startsWith("/") && !value.startsWith("//")) {
		return true;
	}

	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}
