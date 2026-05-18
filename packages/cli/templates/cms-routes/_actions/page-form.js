import { generateSlug } from "@techstream/quark-cms";
import {
	hasRenderablePageContent,
	parsePageBuilderInput,
	serializePageContentToBody,
} from "@techstream/quark-cms/page-builder";
import { ValidationError } from "@techstream/quark-core";
import { z } from "zod";

const RESERVED_PAGE_SLUGS = new Set(["admin", "api", "auth", "playground"]);

function getStringValue(value) {
	return typeof value === "string" ? value : "";
}

export const pageSchema = z.object({
	title: z.preprocess(
		(value) => getStringValue(value).trim(),
		z.string().min(1, "Title is required").max(200),
	),
	slug: z.preprocess(
		(value) => getStringValue(value).trim(),
		z
			.string()
			.max(200)
			.regex(
				/^[a-z0-9-]+$/,
				"Slug must be lowercase letters, numbers, and hyphens only",
			)
			.optional()
			.or(z.literal("")),
	),
	excerpt: z.preprocess(
		(value) => getStringValue(value).trim(),
		z.string().max(500).optional().or(z.literal("")),
	),
});

export function parsePageFormData(formData) {
	const raw = Object.fromEntries(formData);
	const result = pageSchema.safeParse(raw);
	if (!result.success) {
		throw new ValidationError(result.error.issues[0].message);
	}

	if (
		result.data.slug &&
		RESERVED_PAGE_SLUGS.has(result.data.slug.toLowerCase())
	) {
		throw new ValidationError("Slug is reserved for an existing route");
	}

	const { layout, content } = parsePageBuilderInput({
		layout: raw.layout,
		content: raw.content,
	});

	if (!hasRenderablePageContent(content)) {
		throw new ValidationError("Add content to at least one section");
	}

	return {
		...result.data,
		layout,
		content,
		body: serializePageContentToBody(content),
	};
}

export function resolvePageSlugCandidate({ title, slug }) {
	const parsedSlug = getStringValue(slug).trim();
	if (parsedSlug) {
		return parsedSlug;
	}

	return generateSlug(getStringValue(title).trim());
}
