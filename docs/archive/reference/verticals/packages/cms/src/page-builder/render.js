import {
	escapeAttribute,
	escapeHtml,
	renderRichText,
	stripHtml,
} from "../sanitize.js";
import {
	hasRenderableBlockContent,
	normalizePageContent,
} from "./normalize.js";

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

export function renderBlockToHtml(block) {
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

export function renderBlockToPlainText(block) {
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
