import { ValidationError } from "@techstream/quark-core";
import { z } from "zod";

export const pageSchema = z.object({
	title: z.string().min(1, "Title is required").max(200),
	slug: z
		.string()
		.min(1, "Slug is required")
		.max(200)
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must be lowercase letters, numbers, and hyphens only",
		),
	body: z.string().min(1, "Body is required"),
	excerpt: z.string().max(500).optional().or(z.literal("")),
});

export function parsePageFormData(formData) {
	const raw = Object.fromEntries(formData);
	const result = pageSchema.safeParse(raw);
	if (!result.success) {
		throw new ValidationError(result.error.issues[0].message);
	}

	return result.data;
}
