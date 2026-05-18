import { generateSlug } from "@techstream/quark-cms";
import {
	hasRenderablePageContent,
	parsePageBuilderInput,
	serializePageContentToBody,
} from "@techstream/quark-cms/page-builder";
import { ValidationError } from "@techstream/quark-core";
import { z } from "zod";

const RESERVED_PAGE_SLUGS = new Set(["admin", "api", "auth", "playground"]);
const EMPTY_GENERATED_SLUG_MESSAGE =
	"Add a custom slug when the title cannot be converted into a URL path";

function getStringValue(value) {
	return typeof value === "string" ? value : "";
}

export function assertPageSlugAllowed(slug) {
	const normalizedSlug = getStringValue(slug).trim().toLowerCase();
	if (normalizedSlug && RESERVED_PAGE_SLUGS.has(normalizedSlug)) {
		throw new ValidationError("Slug is reserved for an existing route");
	}
}

export function resolvePageSlugCandidate({ title, slug }) {
	const candidate =
		getStringValue(slug).trim() || generateSlug(getStringValue(title));
	if (!candidate) {
		throw new ValidationError(EMPTY_GENERATED_SLUG_MESSAGE);
	}
	assertPageSlugAllowed(candidate);
	return candidate;
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

	assertPageSlugAllowed(result.data.slug);

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
