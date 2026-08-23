import { ValidationError } from "@techstream/quark-core/errors";
import { z } from "zod";
import {
	getStringValue,
	getTrimmedString,
	sanitizeRichTextHtml,
} from "../sanitize.js";

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

export const DEFAULT_PAGE_BLOCK_IDS = {
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

export const pageBuilderInputSchema = z.object({
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

export function createDeterministicPageBlock(type, id, overrides = {}) {
	return pageBlockSchema.parse({
		id,
		...getDefaultBlockForType(type),
		...overrides,
	});
}

export function coerceJsonValue(value) {
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

export function isSafePathOrUrl(value) {
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

export function normalizeBackgroundToneValue(value) {
	const normalized = getTrimmedString(value).toLowerCase();
	return PAGE_BACKGROUND_TONE_VALUES.includes(normalized)
		? normalized
		: "primary";
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

function createBlockId() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return `page-block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
