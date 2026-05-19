const DEFAULT_PAGE_BLOCK_IDS = {
	initialDefault: "page-block-initial-default",
	legacyBody: "page-block-legacy-body",
};

const BACKGROUND_TONES = new Set([
	"surface",
	"muted",
	"primary",
	"info",
	"success",
	"warning",
]);

const BACKGROUND_ANIMATIONS = new Set([
	"background-waves",
	"background-polygon",
	"background-grid",
	"background-aurora",
	"background-data-stream",
	"background-isometric",
	"background-stars",
	"background-streaks",
	"background-vapor",
]);

export function parseStoredPageContent(content) {
	const value = coerceJsonValue(content);
	if (!Array.isArray(value)) {
		return null;
	}

	const blocks = value
		.map((block, index) => normalizePageBlock(block, index))
		.filter(Boolean);

	return blocks;
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
			{
				id: DEFAULT_PAGE_BLOCK_IDS.legacyBody,
				type: "default",
				eyebrow: "",
				title: "",
				body: legacyBody,
			},
		];
	}

	return [
		{
			id: DEFAULT_PAGE_BLOCK_IDS.initialDefault,
			type: "default",
			eyebrow: "",
			title: "",
			body: "",
		},
	];
}

function normalizePageBlock(block, index) {
	if (!block || typeof block !== "object") {
		return null;
	}

	const id = getTrimmedString(block.id) || `page-block-${index + 1}`;

	switch (block.type) {
		case "hero": {
			const backgroundMode = normalizeBackgroundMode(block.backgroundMode);
			return {
				id,
				type: "hero",
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				subtitle: sanitizeRichTextHtml(getStringValue(block.subtitle)),
				backgroundMode,
				backgroundValue: normalizeBackgroundValue(
					backgroundMode,
					block.backgroundValue,
				),
				backgroundTone: normalizeBackgroundToneValue(block.backgroundTone),
			};
		}
		case "default":
			return {
				id,
				type: "default",
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				body: sanitizeRichTextHtml(getStringValue(block.body)),
			};
		case "split":
			return {
				id,
				type: "split",
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				leftKind: block.leftKind === "image" ? "image" : "text",
				leftBody: sanitizeRichTextHtml(getStringValue(block.leftBody)),
				leftSrc: sanitizePathOrUrl(block.leftSrc),
				leftAlt: getTrimmedString(block.leftAlt),
				rightKind: block.rightKind === "image" ? "image" : "text",
				rightBody: sanitizeRichTextHtml(getStringValue(block.rightBody)),
				rightSrc: sanitizePathOrUrl(block.rightSrc),
				rightAlt: getTrimmedString(block.rightAlt),
			};
		case "cta": {
			const backgroundMode = normalizeBackgroundMode(block.backgroundMode);
			return {
				id,
				type: "cta",
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

function sanitizePathOrUrl(value) {
	const normalized = getTrimmedString(value);
	return isSafePathOrUrl(normalized) ? normalized : "";
}

function sanitizeRichTextHtml(html) {
	return getStringValue(html)
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

function stripHtml(value) {
	return String(value ?? "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}

function normalizeBackgroundMode(value) {
	return value === "animation" ? "animation" : "color";
}

function normalizeBackgroundValue(mode, value) {
	if (mode === "animation") {
		return normalizeAnimationValue(value);
	}

	const normalized = getTrimmedString(value).toLowerCase();
	return BACKGROUND_TONES.has(normalized) ? normalized : "primary";
}

function normalizeBackgroundToneValue(value) {
	const normalized = getTrimmedString(value).toLowerCase();
	return BACKGROUND_TONES.has(normalized) ? normalized : "primary";
}

function normalizeAnimationValue(value) {
	const normalized = getTrimmedString(value)
		.toLowerCase()
		.replaceAll("_", "-")
		.replaceAll(/\s+/g, "-");
	if (!normalized) {
		return "background-aurora";
	}

	if (BACKGROUND_ANIMATIONS.has(normalized)) {
		return normalized;
	}

	if (!normalized.startsWith("background-")) {
		const prefixed = `background-${normalized}`;
		if (BACKGROUND_ANIMATIONS.has(prefixed)) {
			return prefixed;
		}
	}

	return "background-aurora";
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
