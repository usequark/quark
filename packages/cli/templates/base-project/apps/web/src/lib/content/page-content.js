const DEFAULT_PAGE_BLOCK_IDS = {
	initialRichText: "page-block-initial-rich-text",
	legacyBody: "page-block-legacy-body",
};

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

	if (getTrimmedString(fallbackBody)) {
		return [
			{
				id: DEFAULT_PAGE_BLOCK_IDS.legacyBody,
				type: "richText",
				html: sanitizeRichTextHtml(fallbackBody),
			},
		];
	}

	return [
		{
			id: DEFAULT_PAGE_BLOCK_IDS.initialRichText,
			type: "richText",
			html: "",
		},
	];
}

function normalizePageBlock(block, index) {
	if (!block || typeof block !== "object") {
		return null;
	}

	const id = getTrimmedString(block.id) || `page-block-${index + 1}`;

	switch (block.type) {
		case "richText":
			return {
				id,
				type: "richText",
				html: sanitizeRichTextHtml(getStringValue(block.html)),
			};
		case "image":
			return {
				id,
				type: "image",
				src: sanitizePathOrUrl(block.src),
				alt: getTrimmedString(block.alt),
				caption: getTrimmedString(block.caption),
				width: getImageWidth(block.width),
			};
		case "mediaText":
			return {
				id,
				type: "mediaText",
				src: sanitizePathOrUrl(block.src),
				alt: getTrimmedString(block.alt),
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				body: getTrimmedString(block.body),
				mediaPosition: block.mediaPosition === "right" ? "right" : "left",
			};
		case "cta":
			return {
				id,
				type: "cta",
				eyebrow: getTrimmedString(block.eyebrow),
				title: getTrimmedString(block.title),
				body: getTrimmedString(block.body),
				buttonLabel: getTrimmedString(block.buttonLabel),
				buttonHref: sanitizePathOrUrl(block.buttonHref),
			};
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

function getImageWidth(width) {
	if (width === "full" || width === "wide") {
		return width;
	}

	return "content";
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
		.replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "")
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
