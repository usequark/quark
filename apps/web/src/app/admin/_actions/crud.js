"use server";

import {
	adminConfig,
	coerceId,
	createRecord,
	deleteRecord,
	getModelBySlug,
	hasIdField,
	isEditable,
	updateRecord,
} from "@techstream/quark-admin";
import { ForbiddenError, NotFoundError } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-middleware";
import {
	isPublicContentModel,
	revalidatePublicContent,
} from "@/lib/public-content-revalidation.js";

/**
 * Coerce raw form data values to the correct types for a Prisma model.
 * @param {import('@techstream/quark-admin').Model} model
 * @param {FormData} formData
 * @returns {Record<string, unknown>}
 */
function extractFormData(model, formData) {
	const data = {};
	for (const field of model.fields) {
		if (!isEditable(field)) continue;
		const raw = formData.get(field.name);

		if (raw === null || raw === "") {
			// Optional fields can be null; required have default values handled by Prisma
			if (!field.isRequired) data[field.name] = null;
			continue;
		}

		switch (field.type) {
			case "Int":
			case "Float":
			case "Decimal":
			case "BigInt":
				data[field.name] = Number(raw);
				break;
			case "Boolean":
				data[field.name] = raw === "on" || raw === "true";
				break;
			case "DateTime":
				data[field.name] = new Date(raw);
				break;
			case "Json":
				try {
					data[field.name] = JSON.parse(raw);
				} catch {
					data[field.name] = raw;
				}
				break;
			default:
				data[field.name] = raw;
		}
	}
	return data;
}

/**
 * Server Action: create a new record for a model.
 * @param {string} slug - URL slug for the model
 * @param {FormData} formData
 */
export async function adminCreate(slug, formData) {
	await requireRole("admin");

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) throw new NotFoundError("Model not found");

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	if (overrides.readOnly) throw new ForbiddenError("Model is read-only");

	const data = extractFormData(model, formData);
	await createRecord(prisma, model.name, data);
	if (await isPublicContentModel(model.name)) {
		await revalidatePublicContent();
	}

	revalidatePath(`/admin/${slug}`);
	redirect(`/admin/${slug}`);
}

/**
 * Server Action: update an existing record.
 * @param {string} slug
 * @param {string} id
 * @param {FormData} formData
 */
export async function adminUpdate(slug, id, formData) {
	await requireRole("admin");

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) throw new NotFoundError("Model not found");

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	if (overrides.readOnly) throw new ForbiddenError("Model is read-only");

	const data = extractFormData(model, formData);
	await updateRecord(prisma, model.name, coerceId(model, id), data);
	if (await isPublicContentModel(model.name)) {
		await revalidatePublicContent();
	}

	revalidatePath(`/admin/${slug}`);
	revalidatePath(`/admin/${slug}/${id}`);
	redirect(`/admin/${slug}`);
}

/**
 * Server Action: delete a record.
 * @param {string} slug
 * @param {string} id
 */
export async function adminDelete(slug, id) {
	await requireRole("admin");

	const model = getModelBySlug(slug);
	if (!model || !hasIdField(model)) throw new NotFoundError("Model not found");

	const overrides = adminConfig.modelOverrides[model.name] ?? {};
	if (overrides.readOnly) throw new ForbiddenError("Model is read-only");

	await deleteRecord(prisma, model.name, coerceId(model, id));
	if (await isPublicContentModel(model.name)) {
		await revalidatePublicContent();
	}

	revalidatePath(`/admin/${slug}`);
	redirect(`/admin/${slug}`);
}
