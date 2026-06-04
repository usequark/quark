function getStringValue(value) {
	if (typeof value === "string") {
		return value;
	}
	if (value === null || value === undefined) {
		return "";
	}
	return String(value);
}

export function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function escapeAttribute(value) {
	return escapeHtml(value);
}

export function stripHtml(value) {
	return String(value ?? "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
}

export function sanitizeRichTextHtml(html) {
	return getStringValue(html)
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

export function renderRichText(text) {
	const trimmed = getTrimmedString(text);
	if (!trimmed) {
		return "";
	}

	if (/<[a-z][\s\S]*>/i.test(trimmed)) {
		return sanitizeRichTextHtml(trimmed);
	}

	return trimmed
		.split(/\n{2,}/)
		.map(
			(paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
		)
		.join("");
}

function getTrimmedString(value) {
	const str = getStringValue(value);
	return str.trim();
}
