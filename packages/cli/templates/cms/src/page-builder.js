import { ValidationError } from "@techstream/quark-core/errors";
import { z } from "zod";

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

export const PAGE_BLOCK_TYPES = [
	{
		value: "richText",
		label: "Rich Text",
		description: "Formatted copy for the main body of the page.",
	},
	{
		value: "image",
		label: "Image",
		description: "A standalone visual section with optional caption.",
	},
	{
		value: "mediaText",
		label: "Media + Text",
		description: "A side-by-side section for an image and supporting copy.",
	},
	{
		value: "cta",
		label: "Call To Action",
		description: "A closing conversion section with a button.",
	},
];

const DEFAULT_PAGE_BLOCK_IDS = {
	initialRichText: "page-block-initial-rich-text",
	legacyBody: "page-block-legacy-body",
};

const BLOCK_ID_SCHEMA = z.string().min(1).max(100);
const PAGE_LAYOUT_SCHEMA = z.enum(PAGE_LAYOUT_VALUES);

const richTextBlockSchema = z.object({
	id: BLOCK_ID_SCHEMA,
	type: z.literal("richText"),
	html: z.preprocess(
		(value) => sanitizeRichTextHtml(getStringValue(value)),
		z.string(),
	),
});

const imageBlockSchema = z.object({
	id: BLOCK_ID_SCHEMA,
	type: z.literal("image"),
	src: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().refine((value) => !value || isSafePathOrUrl(value), {
			message: "Image blocks must use an http(s) or root-relative URL",
		}),
	),
	alt: z.preprocess((value) => getTrimmedString(value), z.string().max(200)),
	caption: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().max(500),
	),
	width: z.enum(["content", "wide", "full"]),
});

const mediaTextBlockSchema = z.object({
	id: BLOCK_ID_SCHEMA,
	type: z.literal("mediaText"),
	src: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().refine((value) => !value || isSafePathOrUrl(value), {
			message: "Media sections must use an http(s) or root-relative URL",
		}),
	),
	alt: z.preprocess((value) => getTrimmedString(value), z.string().max(200)),
	eyebrow: z.preprocess((value) => getTrimmedString(value), z.string().max(80)),
	title: z.preprocess((value) => getTrimmedString(value), z.string().max(160)),
	body: z.preprocess((value) => getTrimmedString(value), z.string().max(2000)),
	mediaPosition: z.enum(["left", "right"]),
});

const ctaBlockSchema = z.object({
	id: BLOCK_ID_SCHEMA,
	type: z.literal("cta"),
	eyebrow: z.preprocess((value) => getTrimmedString(value), z.string().max(80)),
	title: z.preprocess((value) => getTrimmedString(value), z.string().max(160)),
	body: z.preprocess((value) => getTrimmedString(value), z.string().max(1000)),
	buttonLabel: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().max(80),
	),
	buttonHref: z.preprocess(
		(value) => getTrimmedString(value),
		z.string().refine((value) => !value || isSafePathOrUrl(value), {
			message: "CTA links must use an http(s) or root-relative URL",
		}),
	),
});

export const pageBlockSchema = z.discriminatedUnion("type", [
	richTextBlockSchema,
	imageBlockSchema,
	mediaTextBlockSchema,
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
			"richText",
			DEFAULT_PAGE_BLOCK_IDS.initialRichText,
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
	const result = pageContentSchema.safeParse(coerceJsonValue(content));
	return result.success ? result.data : null;
}

export function normalizePageContent(content, fallbackBody = "") {
	const parsedContent = parseStoredPageContent(content);
	if (parsedContent && parsedContent.length > 0) {
		return parsedContent;
	}

	if (getTrimmedString(fallbackBody)) {
		return [
			createDeterministicPageBlock(
				"richText",
				DEFAULT_PAGE_BLOCK_IDS.legacyBody,
				{
					html: sanitizeRichTextHtml(fallbackBody),
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
		case "richText":
			return { type, html: "" };
		case "image":
			return { type, src: "", alt: "", caption: "", width: "content" };
		case "mediaText":
			return {
				type,
				src: "",
				alt: "",
				eyebrow: "",
				title: "",
				body: "",
				mediaPosition: "left",
			};
		case "cta":
			return {
				type,
				eyebrow: "",
				title: "",
				body: "",
				buttonLabel: "",
				buttonHref: "",
			};
		default:
			throw new ValidationError(`Unsupported page block type: ${type}`);
	}
}

function createBlockId() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return `page-block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStringValue(value) {
	return typeof value === "string" ? value : "";
}

function getTrimmedString(value) {
	return getStringValue(value).trim();
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
		case "richText":
			return stripHtml(block.html).trim().length > 0;
		case "image":
			return Boolean(block.src);
		case "mediaText":
			return Boolean(block.src || block.eyebrow || block.title || block.body);
		case "cta":
			return Boolean(
				block.eyebrow ||
					block.title ||
					block.body ||
					(block.buttonLabel && block.buttonHref),
			);
		default:
			return false;
	}
}

function renderBlockToHtml(block) {
	if (!hasRenderableBlockContent(block)) {
		return "";
	}

	switch (block.type) {
		case "richText":
			return sanitizeRichTextHtml(block.html);
		case "image": {
			const caption = block.caption
				? `<figcaption>${escapeHtml(block.caption)}</figcaption>`
				: "";
			return `<figure><img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt)}" />${caption}</figure>`;
		}
		case "mediaText": {
			const body = renderTextParagraphs(block.body);
			const image = block.src
				? `<figure><img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt)}" /></figure>`
				: "";
			const text = [
				block.eyebrow ? `<p>${escapeHtml(block.eyebrow)}</p>` : "",
				block.title ? `<h2>${escapeHtml(block.title)}</h2>` : "",
				body,
			]
				.filter(Boolean)
				.join("");
			return `<section>${image}${text}</section>`;
		}
		case "cta": {
			const button =
				block.buttonLabel && block.buttonHref
					? `<p><a href="${escapeAttribute(block.buttonHref)}">${escapeHtml(block.buttonLabel)}</a></p>`
					: "";
			return `<section>${[
				block.eyebrow ? `<p>${escapeHtml(block.eyebrow)}</p>` : "",
				block.title ? `<h2>${escapeHtml(block.title)}</h2>` : "",
				renderTextParagraphs(block.body),
				button,
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
		case "richText":
			return stripHtml(block.html).trim();
		case "image":
			return [block.alt, block.caption].filter(Boolean).join("\n").trim();
		case "mediaText":
			return [block.eyebrow, block.title, block.body]
				.filter(Boolean)
				.join("\n")
				.trim();
		case "cta":
			return [block.eyebrow, block.title, block.body, block.buttonLabel]
				.filter(Boolean)
				.join("\n")
				.trim();
		default:
			return "";
	}
}

function renderTextParagraphs(text) {
	const trimmed = getTrimmedString(text);
	if (!trimmed) {
		return "";
	}

	return trimmed
		.split(/\n{2,}/)
		.map(
			(paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
		)
		.join("");
}

function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
	return escapeHtml(value);
}

function stripHtml(value) {
	return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function sanitizeRichTextHtml(html) {
	return html
		.replace(
			/<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|select|button|link|meta)[^>]*>/gi,
			"",
		)
		.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(
			/\s(href|src)\s*=\s*(?:(["'])\s*javascript:[^"']*\2|javascript:[^\s>]+)/gi,
			"",
		)
		.trim();
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
